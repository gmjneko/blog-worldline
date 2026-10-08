---
title: 一个被吞掉的 break？给 Kotlin/Native 编译器修个 Bug
published-at: 2026-08-20
description: 一个 as 都没写，却收到了 ClassCastException？
featured-image: ./images/dafeiyu.png
---
#  一个被遗漏的 break

Issue：[KT-88544](https://youtrack.jetbrains.com/issue/KT-88544)　|　PR：[JetBrains/kotlin#7466](https://github.com/JetBrains/kotlin/pull/7466)

## 一、事情是这样的

在我用 Kotlin/Native 给自己的 Coding Agent 写配置文件解析的时候，写了这么一段代码（为了方便阅读，这里是简化过的版本）：

```kotlin
sealed interface Section {
    data object Root : Section
    data class Table(val name: String) : Section
}

private val ROOT_KEYS = setOf("model", "max_turns")

fun parseToml(text: String): Map<String, String> {
    val result = mutableMapOf<String, String>()
    var section: Section = Section.Root

    for (rawLine in text.lines()) {
        val line = rawLine.substringBefore('#').trim()
        if (line.isEmpty()) continue

        // 遇到 [xxx] 这样的表头，切换到对应的表，然后直接去读下一行
        if (line.startsWith('[') && line.endsWith(']')) {
            section = Section.Table(line.removeSurrounding("[", "]").trim())
            continue
        }

        val key = line.substringBefore('=').trim()
        val value = line.substringAfter('=').trim().removeSurrounding("\"")

        when (section) {
            Section.Root -> {
                require(key in ROOT_KEYS) { "未知的配置项: $key" }
                result[key] = value
            }
            is Section.Table -> result["${section.name}.$key"] = value
        }
    }
    return result
}
```

配置文件长这样：

```toml
model = "claude-opus-5"
max_turns = 256

[provider]
api_key = "sk-xxxxxxxxxxxxxxx"
base_url = "https://api.example.com"
```

逻辑并不复杂：一行一行地读，遇到 `[provider]` 这样的表头，就把 `section` 切到 `Section.Table("provider")`，然后 `continue` 去读下一行；遇到 `key = value`，就看看当前在哪个 `section` 里。在 `Root` 下校验一下是不是预定义的合法配置项，在 `Table` 里的话就拼成 `provider.api_key` 存起来。

这段代码一直运行正常。后面在我更新了一次 Kotlin 版本后，奇迹般地发现 Agent 启动不起来了：

```
Uncaught Kotlin exception: kotlin.IllegalArgumentException: 未知的配置项: api_key
```

![呆萌](./images/images1.jpg)

`api_key` 明明在 `[provider]` 底下，怎么就跑到根上去了？

哦？我代码写错了？

更离谱的是，我顺手用 debug 模式跑了一下单元测试，报的是另一个错：

```
kotlin.ClassCastException: class Section.Table cannot be cast to class Section.Root
    at kotlin.ClassCastException#<init>(Unknown Source)
    at <global>.ThrowClassCastException(Unknown Source)
    at kotlin.native.internal#downcast(Unknown Source)
    at <global>.#parseToml(Unknown Source)
    ...
```

我整个函数里一个 `as` 都没写，这个 cast 是从哪冒出来的？

于是，一个横跨了 Kotlin/Native 两个大版本的类型推断（Type Inference） Bug 就此现身。

## 二、Bug 的查找与定位

### 2.1 对照实验

![不会用就别用](./images/kotlin-chan.jpg)

在怀疑编译器之前，我先用同一份代码和测试比较不同后端的行为。我这个项目是 Kotlin Multiplatform 的，除了 Native 之外还挂着一个 JVM target。所以最方便的对照实验就是：同一份代码、同一份测试，换个平台跑。

- `jvmTest`：通过；
- Native 测试（`mingwX64`、`macosArm64`）：`ClassCastException`。

然后把 Kotlin 版本挨个切回去试：

| Kotlin 版本 | 结果 |
| --- | --- |
| 2.2.20 | 正常 |
| 2.3.21 | `ClassCastException` |
| 2.4.10 | `ClassCastException` |
| 2.4.20-RC | `ClassCastException` |

同样的代码，JVM 上没问题，Native 上旧版本也没问题，只在 Kotlin/Native 的新版本中出现，因而调查重点应转向 Native 编译器。

### 2.2 缩减为最小复现

真实项目包含较多无关逻辑。为了定位问题并提交 Issue，我逐步删减代码，最后剩下这么个东西：

```kotlin
sealed interface S {
    data object A : S
    data class B(val v: Int) : S
}

fun proceed() = true

// 对 s 的写入只能通过 break 到达循环后面的代码
fun reachedByBreak(): Int {
    var s: S = S.A
    while (proceed()) {
        s = S.B(42)
        break
    }
    return when (s) {
        S.A -> 0
        is S.B -> s.v
    }
}

// 对 state 的写入只能通过 continue 到达下一轮循环
fun reachedByContinue(): Int {
    var state: S = S.A
    for (shouldUpdate in listOf(true, false)) {
        if (shouldUpdate) {
            state = S.B(42)
            continue
        }
        return when (val current = state) {
            S.A -> 0
            is S.B -> current.v
        }
    }
    error("unreachable")
}
```

第二个函数就是我的 TOML 解析器的骨架：写入 `section` 之后紧跟着一个 `continue`，在下一轮循环中读取该状态。

JVM 上两个函数都返回 `42`。Kotlin/Native debug 构建会抛出 `ClassCastException`；release 构建则不报错，但两个函数都错误地返回 `0`。

### 2.3 Debug 和 Release 的行为不一致

同一个 Bug，在不同构建配置下表现完全不同，这件事本身就很可疑。我用 Kotlin 2.4.20-RC 在 `mingwX64` 上把几种组合都试了一遍：

| 配置 | 结果 |
| --- | --- |
| debug（默认启用 `genericSafeCasts`） | 抛出 `ClassCastException` |
| debug + `-Xbinary=genericSafeCasts=false` | 返回 `42`，异常不再出现 |
| release（`-opt`） | 静默返回 `0` |
| release + `-Xdisable-phases=ComputeTypes` | 返回 `42` |

最后一行先剧透了答案，我们还是按顺序来讲。

`genericSafeCasts` 是 Kotlin/Native 的一个二进制选项启用后，编译器会对某些隐式类型转换执行运行时检查。它在 debug 下默认开启，在 `-opt` 下默认关闭。关闭它后，debug 异常消失，说明异常与编译器生成的隐式转换有关，也与堆栈中的 `kotlin.native.internal#downcast` 相吻合。

可是 Release 下压根没有这个检查，却仍产生错误结果。这说明运行时检查不是根因；编译器已经错误地推断了变量类型，而检查只是在 debug 下使问题以异常的形式暴露出来。

### 2.4 逐个关闭 phase 查找

Kotlin/Native 后端由多个编译阶段（phase）组成，每个阶段都会对 IR 执行转换或优化。编译器提供 `-Xlist-phases` 查看阶段列表，也可以使用 `-Xdisable-phases=...` 暂停指定阶段。这就给了我们一个类似二分查找的手段：哪个 phase 关掉之后 Bug 消失了，嫌疑就在哪。

逐个关闭相关阶段后，结果如下：

- 关闭 `OptimizeCasts`：问题仍然存在；
- 关闭 `ComputeTypes`：问题消失。

因此，问题与 `ComputeTypes` 阶段有关。需要注意的是，`-Xdisable-phases=ComputeTypes` 必须配置在最终**链接二进制**的任务上；只配置在 klib 编译任务上不会生效。Gradle 配置示例如下：

```kotlin
kotlin {
    macosArm64 {
        binaries.configureEach {
            freeCompilerArgs += "-Xdisable-phases=ComputeTypes"
        }
    }
}
```

原因是 `ComputeTypesPass` 在链接阶段运行，后文会进一步说明。

### 2.5 读源码

嫌疑范围缩小到 `ComputeTypesPass` 后，开始检查对应实现：
`kotlin-native/backend.native/compiler/ir/backend.native/src/org/jetbrains/kotlin/backend/konan/optimizations/ComputeTypesPass.kt`，整个文件 500 来行，核心的分析逻辑不到 300 行，还算友好。

因为前面已经知道问题和 `break`/`continue` 有关，我们直接去找处理这两种跳转的地方，重点检查了 `visitBreak` 和 `visitContinue`，这两个方法会把当前路径上的数据流信息记录到 `breaksCFMPInfo` 和 `continuesCFMPInfo` 这两个"控制流汇合槽"里。但在循环处理中，**没有任何地方去读这两个槽位中汇总的值**。

而同一个文件里，其他所有类似的"汇合点"（`when`、`try`、带返回值的 block、`while` 的外层……）正确取用了`cfmpInfo.variablesValues` 作为合并后的数据流状态。另一个结构几乎一模一样的 pass，`CastsOptimization`，在处理循环时也会合并 `break` 和 `continue` 对应的控制流边。这表明遗漏汇合结果并非有意设计。

提 issue 之前，我去 YouTrack 上翻了翻已有的相似问题。比如 2.4.20 修过的 KT-86949，同样是 `ComputeTypesPass` 处理循环时出的错，但仔细看下来是另一个问题（后面会简单说一下区别）。

到这里，问题可以概括为：循环分析中记录了 `break` 和 `continue` 路径，却没有将它们纳入汇合结果。但"少读了一个控制流汇合槽"和"一个 `data object` 被当成了另一个类"之间还隔着好几层，下面我们逐层解析。

## 三、Bug 的原因解析

### 3.1 Kotlin/Native 的编译流程

Kotlin/Native 的编译大致分成两个阶段：

```
第一阶段（编译）：  .kt  ->  前端 K2  ->  IR  ->  .klib

第二阶段（链接）：  所有 .klib  ->  内联 / lowering / 优化  ->  LLVM  ->  可执行文件
```

- **第一阶段**：编译器前端（K2）做语法分析（Parsing）和类型检查（Type Checking），把代码转成 IR（Intermediate Representation，中间表示），并序列化成 `.klib` 文件。Gradle 里的 `compileKotlinMacosArm64` 属于此阶段。
- **第二阶段**：编译器读取应用及所有依赖的 klib，执行内联、lowering 和优化，最后交给 LLVM 生成机器码。`linkDebugExecutableMacosArm64` 等任务属于这个阶段。

> IR 是编译器内部使用的中间表示，结构比源代码更规整，也比机器码更接近高级语言。Lowering 是逐步降低抽象层级的转换，比如把 `for` 循环转换为基于迭代器的循环结构，把 `when` 转换为 `if-else`。

`ComputeTypesPass` 在第二阶段运行，因此只在第一阶段的编译任务上设置 `-Xdisable-phases` 不会影响它。

### 3.2 ComputeTypesPass 的职责

ComputeTypesPass 是在 2.3.20 引入的（[KT-83036](https://youtrack.jetbrains.com/issue/KT-83036)），起因是**内联会擦除泛型**，用于处理内联后类型信息精度下降的问题。

考虑下面这段代码（来自这个 pass 自带的测试）：

```kotlin
fun foo(x: Int) = x.toString()

fun bar(y: Int): String {
    val s = y.let { foo(it) }
    return s
}
```

`let` 是一个 inline 函数，签名是 `inline fun <T, R> T.let(block: (T) -> R): R`。在第二阶段内联之后，`T` 和 `R` 这两个类型参数不再以原来的泛型形式存在，编译器只能保守地把它们当成上界 `Any?`：`it` 变成了一个 `Any?` 类型的临时变量（于是 `y` 需要先装箱成一个 `Int` 对象），返回值也是 `Any?`，使用的时候再转回 `String`。

本来只是简单地传个 `Int`，结果变成了一次装箱、一次拆箱，外加一次类型转换。在启用 `genericSafeCasts` 时，相关转换还可能包含运行时检查，对性能的影响更大。

`ComputeTypesPass` 要做的就是：**在内联后重新分析变量可能接收的值，并据此恢复更精确的类型**。比如上面那个临时变量，它只可能被赋值为 `y`，编译器便可以将其类型收窄为 `Int`，进而避免不必要的装箱和拆箱。

> 该 pass 在第二阶段运行两次：一次位于内联之后不久，另一次位于编译后期、类型转换相关 lowering 之前，用于修正中间 lowering 导致的类型精度损失。

思路很好，要完成这项工作，编译器必须分析变量写入如何沿控制流传播。

### 3.3 数据流分析与到达定值

编译器怎么知道一个变量"可能是什么"？

学过编译原理的同学都知道，编译器做优化的时候，通常会把一个函数看成一张**控制流图（Control Flow Graph，CFG）**：图里的每个节点是一段顺序执行的代码，边代表可能的控制流转移。条件分支会产生多条边；循环包含回边；`break`、`continue` 和 `return` 则会把控制流转移到其他位置。

在这张图上，我们关心的问题是：**在某个位置读变量 `x` 的时候，哪些写入可能为这次读取提供当前值？** 这就是经典的**到达定值分析（Reaching Definitions）**。这里的"定值"（definition）指对变量的一次写入，比如 `var s: S = S.A` 和 `s = S.B(42)` 是对 `s` 的两次定值。

如果存在一条从某次写入到目标位置的路径，且路径上没有对同一变量的后续写入覆盖它，那么这次写入就能到达该位置。

对每个节点 $n$，我们用 $\mathrm{IN}[n]$ 表示进入 $n$ 时可能到达的写入集合，用 $\mathrm{OUT}[n]$ 表示离开 $n$ 时的集合。节点内部的写入可由两个集合描述：

- $\mathrm{gen}[n]$：节点内产生的新写入；
- $\mathrm{kill}[n]$：被节点内写入覆盖的旧写入，即对同一变量的其他写入。

于是有：

$$
\mathrm{OUT}[n] = \mathrm{gen}[n] \cup \left(\mathrm{IN}[n] \setminus \mathrm{kill}[n]\right)
$$

人话：离开节点 $n$ 时仍然有效的写入 = $n$ 节点内新产生的写入 + 加上进入节点时已有且未被 $n$ 覆盖的写入。

那 $\mathrm{IN}[n]$ 怎么算呢？一个节点可能有多个前驱（比如 `if` 两个分支汇合的地方），程序运行时只会经过其中一条路径，但编译器不知道是哪一条，所以静态分析必须覆盖所有可能路径。因此，只要某次写入能从任一前驱到达，就应将它纳入集合。所以，如果我们要得到这个变量在某个位置所有可能的值，就要把所有前驱的集合取**并集**：

$$
\mathrm{IN}[n] = \bigcup_{p \,\in\, \mathrm{pred}(n)} \mathrm{OUT}[p]
$$

这次 Bug 的关键就在于此：**$\mathrm{pred}(n)$ 里所有前驱边都必须参与合并，遗漏任何一条边都可能导致分析结果不健全。**

> 这种"存在一条路径即可成立"的分析称为 may 分析，路径汇合时取并集。与之相对的是 must 分析，要求"所有路径都满足"，汇合时取交集。比如 Kotlin 检查一个 `val` 在使用前是否**一定**被初始化过，就是一个 must 分析：只要存在一条未初始化的路径，就不能证明它已初始化。

得到到达定值集合后，就可以根据所有可能写入的值推导读取点的类型。在位置 $p$ 读 $x$ 时，$x$ 的类型可以取所有可能到达的写入值的类型的**最近公共祖先（Least Common Ancestor，LCA）**：

$$
\tau(x, p) = \mathrm{LCA}\Big(\big\lbrace\, \mathrm{type}(e) \;\big|\; (x := e) \in \mathrm{IN}[p] \,\big\rbrace\Big)
$$

例如，有 `open class Animal`，以及它的两个子类 `Cat` 和 `Dog`。如果在某个位置，`x` 可能是 `Cat()` 也可能是 `Dog()`，那它的类型可以推导为 `Animal`；如果只可能是 `Cat()`，那它的类型就可以收窄成 `Cat`。

一个非常重要的性质：编译器静态分析得到的写入集合必须**包含**所有实际可能到达的所有写入，即

$$
\mathrm{IN}_{\text{computed}}[p] \supseteq \mathrm{IN}_{\text{actual}}[p]
$$

多包含一些写入通常只会使推导类型更宽、降低优化效果；遗漏写入则会排除真实可能的值，编译器会认为某个值"不可能出现"，得出一个过窄的类型，并使后续优化建立在错误前提上。这种分析结果是不健全的（unsound）。

最后还剩一个问题：循环。循环会引入回边，因此循环入口的 $\mathrm{IN}$ 依赖循环体末尾的 $\mathrm{OUT}$，而循环体末尾的 $\mathrm{OUT}$ 又依赖循环入口的 $\mathrm{IN}$，形成了循环依赖。常见做法是**迭代到不动点**：先用一个初始值把循环体分析一遍，用得到的结果更新循环入口的集合，再分析一遍……直到集合不再变化，即达到不动点。因为每轮集合单调增大，且写入总数有限，因此计算一定会收敛（停下）。

> 更严谨地说，所有写入集合在 $\subseteq$ 关系下构成有限格（lattice），传递函数具有单调性，所以迭代会在有限步内收敛到不动点。相关内容可参阅《编译原理》第 9 章。

### 3.4 ComputeTypesPass 的实现

理论讲完了，我们来看下 `ComputeTypesPass` 是怎么实现的。

`ComputeTypesPass` 使用 `BitSet` 表示写入集合。它为函数中变量的每次写入分配编号，然后用一个 `BitSet` 表示"当前可能到达的写入集合"：第 $i$ 位为 1，表示第 $i$ 次写入可能到达此处。分析通过遍历 IR 的 visitor 实现；每个 `visitXxx` 方法接收执行节点前的集合，并返回执行后的集合，对应前文的 $\mathrm{IN}$ 和 $\mathrm{OUT}$。

写入变量的处理直接对应 gen/kill 规则：

```kotlin
fun setVariable(variable: IrVariable, value: IrExpression, variablesValues: BitSet): BitSet {
    val id = getVariableWriteId(variable, value)
    catchesVariablesValues?.set(id)
    val writes = variableWrites[variable] ?: error("A use of uninitialized variable ${variable.render()}")
    return variablesValues.copy().apply {
        andNot(writes) // kill：忘掉这个变量之前的所有写入
        set(id)        // gen：记上这次写入
    }
}
```

读取变量时，分析会筛选出当前集合中属于该变量的写入，并计算它们的公共类型：

```kotlin
override fun visitGetValue(expression: IrGetValue, data: BitSet): BitSet {
    val variable = expression.symbol.owner as? IrVariable ?: return data
    val variableWrites = variableWrites[variable]?.copy()?.apply { and(data) }
            ?: error("A use of uninitialized variable ${variable.render()}")
    val mergedVariableWrites = getValueVariablesWrites.getOrPut(expression) { BitSet() }
    mergedVariableWrites.or(variableWrites)
    expression.type = mergedVariableWrites.computeType() ?: variable.type
    // ...
    return data
}
```

注意 `mergedVariableWrites` 同样通过 `or` 累积结果：循环分析会执行多轮，因此每轮到达该读取点的写入都需要纳入最终集合。

`computeType()` 最终调用的是 `leastCommonAncestor`，也就是在类的继承树上计算最近公共祖先。

> 此处的 LCA 只考虑类，不考虑接口。一个类可以实现多个接口，接口关系无法构成单一的类继承树，局部分析也无法据此确定唯一的公共类型。因此，`S.A` 和 `S.B` 的 LCA 不是 `S`（它是个接口），而是 `Any`。

类型算完之后还有一步改写：如果某次读取的类型比变量声明类型更窄，pass 会在读取表达式外添加 `IMPLICIT_CAST`：

```kotlin
override fun visitGetValue(expression: IrGetValue): IrExpression {
    val valueDeclaration = expression.symbol.owner
    return if (expression.type == valueDeclaration.type)
        expression
    else {
        val actualType = expression.type
        expression.type = valueDeclaration.type
        irBuilder.at(expression).irImplicitCast(expression, actualType)
    }
}
```

`IMPLICIT_CAST` 是 IR 里的一种隐式类型转换，它表达的是“编译器已证明该值属于目标类型”（直接当成这个类型用就行）。和手写的 `as` 不同，它默认**不做任何运行时检查**。若这项证明依赖了不健全的分析，后果便会传递到后续阶段。

> 编译器都保证过了，还检查什么呢？

记住这个"保证过了"，后面是要还的。

![Runtime：哥哥我摔倒了](images/image_2.jpg)

**汇合点。** 控制流汇合由 `ControlFlowMergePointInfo` 和 `controlFlowMergePoint` 处理：

```kotlin
private class ControlFlowMergePointInfo(val variable: IrElement, val needValues: Boolean) {
    val variablesValues = BitSet()
    val variableWrites = if (needValues) BitSet() else null
}

fun controlFlowMergePoint(cfmpInfo: ControlFlowMergePointInfo, value: IrExpression, variablesValues: BitSet): BitSet {
    val result = if (!cfmpInfo.needValues)
        variablesValues
    else {
        val id = getVariableWriteId(cfmpInfo.variable, value)
        cfmpInfo.variableWrites!!.set(id)
        variablesValues.copy().apply { set(id) }
    }

    cfmpInfo.variablesValues.or(result)
    return result
}
```

每条路径汇入时都会调用 `controlFlowMergePoint`。它做了两件事：

1. 把当前路径的集合并入 `cfmpInfo.variablesValues`，也就是公式里的 $\bigcup$；
2. 返回**当前路径**对应的集合。

因此：**返回值只代表当前路径；`cfmpInfo.variablesValues` 才代表所有路径的并集。** 这是理解此次 Bug 的关键。

> `needValues` 是给"汇合点本身也是有值的表达式"的情况用的，比如 `val x = if (c) a else b`，这时汇合点的值也需要分配一个写入编号，作用类似 SSA 里的 phi 节点。循环表达式的类型为 `Unit`，其 `needValues` 为 false，这里可以先忽略。

`when` 的处理正确读取了所有分支的合并结果：

```kotlin
override fun visitWhen(expression: IrWhen, data: BitSet): BitSet {
    val cfmpInfo = ControlFlowMergePointInfo(expression)
    var result = data
    for (branch in expression.branches) {
        result = branch.condition.accept(this, result)
        val branchResult = branch.result.accept(this, result)
        controlFlowMergePoint(cfmpInfo, branch.result, branchResult) // 每个分支汇入一次
    }
    // ...
    return cfmpInfo.variablesValues // 返回所有分支的并集 ✓
}
```

每个分支分别汇入，最后返回`cfmpInfo.variablesValues`（所有分支的并集），与 $\mathrm{IN}[n] = \bigcup \mathrm{OUT}[p]$ 一致。

`break` 和 `continue` 则将当前路径记录到对应循环的汇合信息中：

```kotlin
override fun visitBreak(jump: IrBreak, data: BitSet): BitSet {
    val cfmpInfo = breaksCFMPInfos[jump.loop] ?: error("Break from an unknown loop: ${jump.render()}")
    controlFlowMergePoint(cfmpInfo, dummyUnitExpression, data) // 记到"循环出口"的控制流汇合槽上
    return nothingValue
}

override fun visitContinue(jump: IrContinue, data: BitSet): BitSet {
    val cfmpInfo = continuesCFMPInfos[jump.loop] ?: error("Continue to an unknown loop: ${jump.render()}")
    controlFlowMergePoint(cfmpInfo, dummyUnitExpression, data) // 记到"循环条件"的控制流汇合槽上
    return nothingValue
}
```

它们把当前路径的集合记到对应循环的控制流汇合槽上，然后返回 `nothingValue`，一个空集 $\varnothing$，表示跳转后紧邻的顺序代码不可达。

也就是说，这里的设计是：**`break`/`continue` 不会沿当前顺序路径继续传播状态，而是先把状态存入对应的汇合信息，再由循环处理逻辑读取。**

问题就出在后一步：循环处理逻辑没有正确读取这些汇合结果。

### 3.5 循环中的遗漏

`ComputeTypesPass` 会先把 `while` 循环转换为 `if` + `do-while`，从而统一循环处理逻辑：

```kotlin
while (condition) { body }
// 变成
if (condition) { do { body } while (condition) }
```

一个包含 `break` 和 `continue` 的 `do-while` 控制流可以概括为：

```
                entry
                  │
                  ▼
          ┌───────────────┐
   ┌─────▶│     body      │
   │      │  ...continue ─┼─────────┐
   │      │  ...break    ─┼─────────┼──────────┐
   │      └───────┬───────┘         │          │
   │              │ fall through    │          │
   │              ▼                 │          │
   │      ┌───────────────┐         │          │
   │      │   condition   │◀────────┘          │
   │      └───┬───────┬───┘                    │
   │     true │       │ false                  │
   └──────────┘       ▼                        │
              ┌───────────────┐                │
              │  after loop   │◀───────────────┘
              └───────────────┘
```

显然，从图中可知：

- **循环条件**有两类前驱：循环体正常执行完（fall through），以及循环体里的每一个 `continue`；
- **循环出口**也有两类前驱：条件为假，以及循环体里的每一个 `break`。

因此：

$$
\mathrm{IN}[\mathit{cond}] = \mathrm{OUT}[\mathit{body}] \;\cup\; \bigcup_{i} \mathrm{OUT}[\mathit{continue}_i]
$$

$$
\mathrm{IN}[\mathit{exit}] = \mathrm{OUT}_{\mathit{false}}[\mathit{cond}] \;\cup\; \bigcup_{j} \mathrm{OUT}[\mathit{break}_j]
$$

修复前的 `handleDoWhileLoop`（省略日志）如下：

```kotlin
fun handleDoWhileLoop(loop: IrLoop, variablesValues: BitSet): BitSet {
    var vvAtLoopStart = variablesValues
    var iter = 0
    while (true) {
        ++iter
        val prevVVAtLoopStart = vvAtLoopStart
        val breaksCFMPInfo = ControlFlowMergePointInfo(loop)
        val continuesCFMPInfo = ControlFlowMergePointInfo(loop)
        breaksCFMPInfos[loop] = breaksCFMPInfo
        continuesCFMPInfos[loop] = continuesCFMPInfo
        val vvAtBodyEnd = loop.body?.accept(this, vvAtLoopStart) ?: vvAtLoopStart
        val vvAtConditionStart =
                controlFlowMergePoint(continuesCFMPInfo, dummyUnitExpression, vvAtBodyEnd)      // ①
        val vvAtConditionEnd = loop.condition.accept(this, vvAtConditionStart)
        vvAtLoopStart = vvAtConditionEnd
        if (iter > 1) // Merge starting with the second iteration since the first is always executed.
            vvAtLoopStart.or(prevVVAtLoopStart)

        if (vvAtLoopStart == prevVVAtLoopStart) {
            breaksCFMPInfos.remove(loop)
            continuesCFMPInfos.remove(loop)
            return controlFlowMergePoint(breaksCFMPInfo, dummyUnitExpression, vvAtConditionEnd) // ②
        }
    }
}
```

在标记为 ① 和 ② 的位置，代码都使用了 `controlFlowMergePoint` 的**返回值**。前面我们说过，返回值只是"传进去的那一条路径"：

- 在 ① 处，`vvAtConditionStart` 只包含循环体正常结束时的状态，`continuesCFMPInfo.variablesValues` 中记录的 `continue` 路径都被丢掉了，没有参与后续计算；
- 在 ② 处，循环返回值只包含条件为假时的状态，`breaksCFMPInfo.variablesValues` 中记录的 `break` 路径同样被遗漏。

因此，修复前实际计算的是：

$$
\mathrm{IN}_{\text{old}}[\mathit{cond}] = \mathrm{OUT}[\mathit{body}], \qquad \mathrm{IN}_{\text{old}}[\mathit{exit}] = \mathrm{OUT}_{\mathit{false}}[\mathit{cond}]
$$

公式里的两个 $\bigcup$ 整个没了。两个并集都没有进入结果。`visitBreak` 和 `visitContinue` 虽然记录了路径状态，但循环逻辑没有读取它们。每轮迭代都会重新创建汇合信息，汇合结果始终未被纳入计算。

![soyo](./images/soyo.jpg)

#### 用最小复现跟踪数据流

以 `break` 版本为例，为两次写入编号：

```kotlin
fun reachedByBreak(): Int {
    var s: S = S.A          // w₀
    while (proceed()) {
        s = S.B(42)         // w₁
        break
    }
    return when (s) {       // 在这里读 s
        S.A -> 0
        is S.B -> s.v
    }
}
```

按 `if (proceed()) { do { ... } while (proceed()) }` 分析：

| 位置 | 实际可能到达的写入 | 修复前计算出的集合 |
| --- | --- | --- |
| 进入循环前 | {w₀} | {w₀} |
| 执行完 `s = S.B(42)` | {w₁} | {w₁} |
| `break` 处（记录到出口汇合信息） | {w₁} | {w₁} |
| 循环体正常结束路径（在 `break` 之后，不可达） | ∅ | ∅ |
| `do-while` 的出口 | ∅ ∪ {w₁} = {w₁} | ∅（遗漏了汇合信息） |
| 外层 `if` 汇合（初始条件为假或循环退出） | {w₀, w₁} | {w₀} |
| 读取 `s` | {w₀, w₁} | {w₀} |

对应的类型分别是：

$$
\tau_{\text{actual}} = \mathrm{LCA}(\lbrace \texttt{S.A}, \texttt{S.B} \rbrace) = \texttt{Any}, \qquad \tau_{\text{old}} = \mathrm{LCA}(\lbrace \texttt{S.A} \rbrace) = \texttt{S.A}
$$

修复前，分析认为 `s` 在读取点只可能是 `S.A`，于是生成了一个目标类型为 `S.A` 的 `IMPLICIT_CAST`，并假定转换无需检查。然而实际执行中，`proceed()` 返回 `true`，循环将 `s` 更新为 `S.B(42)` 后执行 `break`；因此读取点上的实际值是 `S.B`。

TOML 解析器对应的是 `continue` 路径：`section = Section.Table(...)` 后立即执行 `continue`，该写入只能经 `continue` 边传播到下一轮。修复前，循环条件的输入状态只包含循环体正常结束路径，分析因而错误地认为读取 `section` 时其值仍为 `Section.Root`。

### 3.6 错误类型如何影响运行结果

到这一步，编译器已经错误地认定 `section` 只可能是 `Section.Root`。Debug 和 Release 构建以不同方式暴露了这一错误。

#### Debug：运行时检查抛出异常

`genericSafeCasts` 的默认值由以下逻辑决定：

```kotlin
private val defaultGenericSafeCasts = !optimizationsEnabled // For now disabled in -opt due to performance penalty.
```

也就是说，该选项在 debug 下默认启用，在优化构建中默认关闭。启用后，后续 lowering（`Autoboxing.kt` 中处理 `insertSafeCasts && operator == IrTypeOperator.IMPLICIT_CAST` 的逻辑）会将 `IMPLICIT_CAST` 转换为带运行时检查的类型转换。

> Kotlin/Native 会擦除泛型（Likes On JVM），从 `List<String>` 里拿出来的元素在底层以 `Any?` 表示，编译器会插入隐式转换将其当成 `String` 用。如果通过 unchecked cast 将其他类型的值放入集合（所谓的堆污染），不检查的话程序就会在某个莫名其妙的地方崩掉，所以运行时检查可以尽早在转换位置报告错误。`genericSafeCasts` 为这类转换提供额外检查，让这类错误尽早、在正确的位置暴露出来，代价是额外的性能开销。

因此，目标类型为 `Section.Root` 的 `IMPLICIT_CAST` 被转换为运行时 downcast。实际值却是 `Section.Table`，于是抛出：

```
kotlin.ClassCastException: class Section.Table cannot be cast to class Section.Root
    at kotlin.native.internal#downcast(Unknown Source)
```

这解释了为何源码没有显式 `as`，运行时仍会出现 `ClassCastException`：该 cast 由编译器生成，检查也由编译器生成。

> 编译器：类型转换包没问题的。（恰腰）
> ![Runtime Belike](./images/cat_head.jpeg)
> Runtime：你先看看你恰的是谁的腰。


#### Release：去虚化放大了错误类型信息

Release 构建默认关闭 `genericSafeCasts`，因此 `IMPLICIT_CAST` 不会执行同样的运行时检查。此时 `IMPLICIT_CAST` 什么也不做。照理说，一个什么也不做的 cast 应该是无害的吧？可是错误的类型信息并没有消失，错误的类型信息仍会被后续优化使用。

`when (section)` 中的 `Section.Root -> ...` 分支最终需要判断 `section == Section.Root`，会变成一次虚函数调用 `section.equals(Section.Root)`。

Release 模式下，Kotlin/Native 会做全程序的**去虚化分析（Devirtualization）**：对每一个虚函数调用，若分析认为某个虚调用的接收者只可能属于一个具体类，就把查虚表的间接调用替换为直接调用。它计算候选类的方式大致是：

$$
\mathrm{candidates} = \mathrm{inheritorsOf}(T_{\text{receiver}}) \;\cap\; \mathrm{instantiatingClasses}
$$

其中 $T_{\text{receiver}}$ 是接收者的静态类型。也就是说，先取接收者静态类型的所有子类，再和程序中实际会被实例化的类取交集。

而接收者的静态类型，恰恰就是被 `ComputeTypesPass` 错误地将其收窄为 `Section.Root` 的那个。`data object` 是 final 的，没有子类，所以去虚化分析只保留：`Section.Root.equals`。于是编译器直接生成了一次对 `Section.Root.equals` 的直接调用，中间没有任何类型检查。

`data object` 自动生成的 `equals` 大致等价于：

```kotlin
override fun equals(other: Any?): Boolean {
    if (this === other) return true
    if (other !is Section.Root) return false
    return true // data object 没有属性需要比较
}
```

> 我们知道，`data object` 的 `equals` 比较的是类型而不是引用，因为通过反射、序列化等方式，一个 `data object` 可能会存在多个实例，按类型比较才能保证它们彼此相等。

现在 `this` 实际上是一个 `Section.Table` 对象，`other` 是 `Section.Root`：

1. `this === other` 为 `False`；
2. `other !is Section.Root` 也为 `False`，因为 `other` 确实是 `Section.Root`；
3. 方法返回 `true`。

因此，`section == Section.Root` 被错误地判定为真，`when` 永远走第一个分支，`api_key` 被当成根级配置项来校验，并触发“未知的配置项: api_key”。

一个错误的类型推断，经过去虚化和 `data object` 的 `equals` 两次接力，最后变成了一个看起来完全合理、实际上完全错误的结果。没有崩溃，也没有警告。

![Kotlin怎么这么坏啊](images/kotlin_bad.jpeg)

> 并非没有崩溃，开发者崩溃了（

#### 其他配置下的表现

- **debug + `genericSafeCasts=false`**：运行时检查被关闭，debug 构建也不执行相同的去虚化优化，虚调用会正常分派到 `Section.Table` 的 `equals`，因此结果正确。分析错误仍然存在，只是没有触发异常或错误优化。
- **JVM**：JVM 后端不使用这里的 `ComputeTypesPass`，因此不会出现该问题。

到这里，前面表格里的四种现象就全部解释通了。

> 后来 JetBrains 把我的 issue 标成了 [KT-88580](https://youtrack.jetbrains.com/issue/KT-88580) 的重复。那是另一位开发者用 antlr-kotlin 时碰到的 release 崩溃，报错是 `Unexpected receiver type: kotlin.collections.ArrayList`。这个异常正是去虚化生成的代码抛出来的：当去虚化分析得到多个候选类时，生成代码会依次进行类型判断；如果实际类型与候选项都不匹配，就可能抛出该异常。不同代码形态因此呈现出不同症状。

> 顺便说一下和 KT-86949 的区别：那个问题是汇合点的 `needValues` 是根据"分析过程中已被修改的类型"算出来的，类型一旦被收窄为 final 类，就无法再扩宽。本次涉及的汇合点类型为 `Unit`/`Int`，`needValues` 从第一次访问开始就是 false，不存在这个问题。

## 四、修复与回归测试

定位清楚之后，修复本身简单得有点不好意思：修复集中在两处，保留 `controlFlowMergePoint` 的汇合副作用，并从对应的汇合信息中读取所有路径的并集。

```diff
                     val vvAtBodyEnd = loop.body?.accept(this, vvAtLoopStart) ?: vvAtLoopStart
-                    val vvAtConditionStart =
-                            controlFlowMergePoint(continuesCFMPInfo, dummyUnitExpression, vvAtBodyEnd)
+                    controlFlowMergePoint(continuesCFMPInfo, dummyUnitExpression, vvAtBodyEnd)
+                    // The condition is reached both by falling through the body and by every continue,
+                    // so the merged values must be taken here, not just the fall-through ones.
+                    val vvAtConditionStart = continuesCFMPInfo.variablesValues
                     val vvAtConditionEnd = loop.condition.accept(this, vvAtConditionStart)
 ...
                     if (vvAtLoopStart == prevVVAtLoopStart) {
                         breaksCFMPInfos.remove(loop)
                         continuesCFMPInfos.remove(loop)
-                        return controlFlowMergePoint(breaksCFMPInfo, dummyUnitExpression, vvAtConditionEnd)
+                        // Same goes for the loop's exit: it is reached both by the condition becoming false
+                        // and by every break.
+                        controlFlowMergePoint(breaksCFMPInfo, dummyUnitExpression, vvAtConditionEnd)
+                        return breaksCFMPInfo.variablesValues
                     }
```

循环体正常结束的状态会与所有 `continue` 路径一起汇入循环条件；条件为假时的状态会与所有 `break` 路径一起汇入循环出口。这样就和公式里的 $\bigcup$ 对上了，也和这个文件里其他所有汇合点、以及 `CastsOptimization` 的写法保持了一致。

以 `break` 复现为例，修复后 `do-while` 出口集合为 `{w₁} ∪ ∅ = {w₁}`；外层 `if` 汇合后得到 `{w₀, w₁}`，读取 `s` 时计算出的类型为 `LCA(S.A, S.B) = Any`。编译器因此不会再将该值错误地收窄为 `S.A`。

**这个修复会不会引入新问题？** 不会，理由也很简单。修复只是让循环条件入口和循环出口的集合**变大**（从"单条路径"变成"所有路径的并集"），而 gen/kill 那个传递函数是单调的：输入变大，输出只会变大或者不变。所以下游所有位置的集合都只会变大。对 LCA 来说：

$$
A \subseteq B \implies \mathrm{LCA}(A) <: \mathrm{LCA}(B)
$$

因为 $\mathrm{LCA}(B)$ 是 $B$ 中所有类型的公共祖先，自然也是 $A$ 中所有类型的公共祖先，而 $\mathrm{LCA}(A)$ 是这些公共祖先里最近的那一个。

修复后的推导类型只会保持原状或变宽。类型变宽可能减少优化机会，但不会再基于遗漏路径作出过窄的类型保证。

### 测试和 review

除了修改实现，还需要添加回归测试。该测试并非 Native 专属，最终测试位于应改为放在公共目录中的 box 测试，路径在 `compiler/testData/codegen/box/controlStructures/kt88544.kt`，加了 `-Xbinary=genericSafeCasts=true -Xdisable-phases=OptimizeCasts` 单独测 `ComputeTypesPass`。

```kotlin
// IGNORE_KLIB_RUNTIME_ERRORS_WITH_CUSTOM_SECOND_STAGE: Native:2.4
// WITH_STDLIB

sealed interface State {
    data object Initial : State

    data class Updated(val value: Int) : State
}

fun proceed() = true

fun reachedByBreak(): Int { /* 和前面的复现代码一样 */ }

fun reachedByContinue(): Int { /* 和前面的复现代码一样 */ }

fun box(): String {
    val byBreak = reachedByBreak()
    if (byBreak != 42) return "fail: break variant returned $byBreak"

    val byContinue = reachedByContinue()
    if (byContinue != 42) return "fail: continue variant returned $byContinue"

    return "OK"
}
```

> box 测试是 Kotlin 编译器仓库里最常见的一类测试：每个测试文件里有一个 `box()` 函数，返回 `"OK"` 就算通过。放在公共目录下的 box 测试会在 JVM、JS、Wasm、Native 等所有后端上跑，因此也可以覆盖其他后端中形态相同的问题。

第一行的 `IGNORE_KLIB_RUNTIME_ERRORS_WITH_CUSTOM_SECOND_STAGE` 是 CI 挂了一次之后加的。Kotlin 的 CI 里有一类 klib 向前兼容测试：用当前版本的编译器做第一阶段生成 klib，再用一个旧版本（这里是 2.4）的编译器做第二阶段链接。而这个 Bug 在第二阶段里，而 2.4 的第二阶段还没修，测试当然会挂。因此需要将 `Native:2.4` 组合下的运行时错误标记为预期结果。

PR 已经 Merged，修复会随 Kotlin 2.5.0 发布（2.5.0-Beta1 里已经有了），JetBrains 也计划把它 cherry-pick 到 2.4.21。

如果你暂时还在受影响的版本上（2.3.20 ~ 2.4.20），又恰好写出了"写入之后只能通过 `break`/`continue` 走到读取"这种形状的代码，可以先在**链接二进制**的任务上加 `-Xdisable-phases=ComputeTypes` 作为规避措施，配置方式见前文。

## 五、总结

回头看，这个 Bug 的根因只有两行：用错了一个函数的返回值。但从这两行到我看到的"未知的配置项"，中间隔了好几层：

1. 到达定值分析遗漏了 `break` 和 `continue` 两类控制流边；
2. 于是一个变量的类型被收窄成了一个 final 类；
3. 编译器据此插入了不带运行时检查的 `IMPLICIT_CAST`；
4. Debug 构建中的 `genericSafeCasts` 将转换变为运行时检查，最终抛出 `ClassCastException`；
5. Release 构建中的去虚化则继续使用错误的接收者类型信息，导致 `when` 进入错误分支。

几点感想：

**先找对照组，再二分。** JVM 对 Native、旧版本对新版本、debug 对 release、关掉某个 phase 对不关……每一组对照都能排除一大片可能性。等到真正开始读源码的时候，范围已经缩小到一个函数里了。所以 Debug 超大项目的源码其实并没有那么可怕。

**may 分析里，少一条边就是 unsound。** 数据流分析多包含一些写入通常只会使分析更保守，少算一点就是错。而且优化越激进，错误的"保证"被兑现得就越离谱：从一个"免检"的 cast，到一个 `ClassCastException`，再到一个静默的错误结果。

**墨菲定律：容易用错的 API，迟早会被用错。** `controlFlowMergePoint` 的返回值是"单条路径"，副作用 `variablesValues` 里收集的才是"所有路径"，两者都是 `BitSet`，长得一模一样。有意思的是，修复之前，整个文件里用到这个返回值的地方只有两处，恰好就是出 Bug 的那两处；修复之后，这个返回值已经没有人用了。如果让我来设计这个接口，大概会让它直接返回 `Unit`，逼着调用者显式地去读 `variablesValues`。

最后，给 Kotlin 提 PR 的体验还是挺不错的：从提 issue、开 PR，到 review、改测试、过 CI、合入，前后一周左右。维护者的意见都很具体，没有任何多余的来回。如果你也在用 Kotlin 时碰到了"不可能"的 Bug，不妨先相信一下自己，然后去源码里找找看。说不定真不是你的问题呢。
