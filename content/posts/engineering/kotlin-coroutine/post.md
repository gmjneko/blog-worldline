---
title: 浅入浅出 Kotlin 协程
published-at: 2026-07-27
description: 协程是 Kotlin 里最容易"会用但说不清楚"的特性，本文试图用人话讲解协程的核心概念和心智模型。
featured-image: ./images/kotlin-chan.jpg
---

如果你使用过或者正在使用 Kotlin，那你大概率使用过它的协程，但你真的理解它吗？

先看 Koaks 框架在用 Runtime 重构前的源码中的一段代码：

```kotlin
fun stream(input: String): Flow<AgentEvent> = flow {
    emitAll(runner.stream(initialMessages(input)))
}
```

它看起来像是在启动一个 Agent 并返回流式事件，但是调用 `stream(input)` 时，Agent 真的被启动了吗？

如果你答不上来，不妨再想两个问题：
1. 源码中的 `initialMessages` 明明是挂起函数，为什么 `stream` 不需要 `suspend`？
2. 为什么还要套一层 `flow`？

---

协程是 Kotlin 里最容易"用得起来但说不清楚"的特性。写几行 `launch {}` 不难，但你真的清楚为什么 `delay(1000)` 不算阻塞线程吗？为什么某个子协程挂了，兄弟协程也一起没了？

这篇文章我们把协程拆成三层来讲：**可挂起的函数**、**有生命周期的作用域**和**以冷流为主的异步数据流**。

需要建立概念的关键词不多：`suspend`、`CoroutineScope`、`Job`、`Dispatcher`、`CoroutineContext`、`launch`、`async`、`coroutineScope`、`Flow`、`collect`、`cancellation`。

## 一、协程解决的是什么问题

先看最朴素的同步代码。这里假设 `fetchUser()` 和 `fetchOrders()` 都是阻塞式网络 API：

```kotlin
val user = api.fetchUser()
val orders = api.fetchOrders(user.id)
println(orders)
```

读起来很顺，问题是 `fetchUser()` 等网络返回期间，当前线程被完全占住。线程是昂贵资源，在服务端和 UI 程序里都不能随便阻塞。

传统解法是回调：

```kotlin
api.fetchUser { user ->
    api.fetchOrders(user.id) { orders ->
        println(orders)
    }
}
```

线程不再被占住了，但代码结构也同时被被牺牲掉，嵌套一深就没法读，异常处理和取消逻辑也开始四处散落。

协程要的是两者兼得：**保留第一种写法的顺序可读性，同时不阻塞线程**。


## 二、协程的心智模型

### 协程不是线程

把协程理解成"可暂停、可恢复的轻量任务"就够了。它跑在某个线程上，但不等于线程——一个线程上可以跑成百上千个协程。

遇到等网络、等 IO、等 `delay` 这类操作时，协程可以**挂起**：把线程让出去给其他线程用，等结果回来了再从暂停的位置继续。

所以这两行的含义完全不同：

```kotlin
Thread.sleep(1000) // 阻塞线程，这一秒线程什么也干不了
delay(1000)        // 挂起协程，当前线程可以继续调度其他任务
```

### suspend 表示"这里可能会暂停"

```kotlin
suspend fun fetchUser(): User {
    delay(1000)
    return User("Tom")
}
```

`suspend` 是给编译器的标记，含义**只有一个**：**这个函数可能在中途暂停，稍后恢复**。它并不代表函数会开线程，也不代表函数一定异步执行。

由此产生一条硬规则：`suspend fun` 只能从协程内部，或者另一个 `suspend fun` 里调用。

```kotlin
suspend fun a() {
    b() // OK
}

suspend fun b() {
    delay(100)
}

fun x() {
    b() // 编译不过
}
```

想从普通函数进入协程，得先拿到一个协程环境：`launch {}`、`async {}`、`runBlocking {}` 等等, `flow {}` 是个例外, 它只是把 `suspend` 调用包起来延后执行，真正进入协程要等 `collect`。

### 挂起背后发生了什么

你写的是顺序代码：

```kotlin
val user = fetchUser()
println(user.name)
```

编译器采用的是 CPS 形式（Continuation-Passing Style）：从调用约定上看，`suspend fun` 会多出一个 `Continuation` 参数；对于需要跨挂起点恢复的函数，编译器通常还会把函数体改写成一个**状态机**，它会在挂起点把函数切成若干段，每段对应状态机的一个 label。挂起时，当前的局部变量和"下一步该跳到哪个 label"被保存在生成的 continuation/state-machine 对象中；恢复时，从那个 label 继续执行。没有实际挂起点或只做尾调用的简单函数，可能不会生成一套完整状态机。

效果上近似于编译器帮你写了回调：

```kotlin
fetchUser { user ->
    println(user.name)
}
```

区别是回调的拆分、现场保存、现场恢复全部由编译器生成，你的源码仍然是顺序的。

这就是协程的核心：**不靠阻塞等待，而靠"暂停当前逻辑，之后从暂停点接着跑"**。

## 三、结构化并发：谁来管这些协程

### CoroutineScope 划定生命周期边界

协程不能凭空启动，它需要一个作用域：

```kotlin
scope.launch {
    doWork()
}
```

`CoroutineScope` 回答的问题很具体：**这些协程归谁管，什么时候该一起结束**。

不同环境有各自的现成作用域。Android 里是 `viewModelScope`、`lifecycleScope`；服务端常见按请求划分的 scope；测试里用 `runTest`；程序入口用 `runBlocking`。

作用域被取消，它名下的协程全部被取消。这就是**结构化并发**。

### launch：启动一个不返回结果的协程

```kotlin
val job: Job = scope.launch {
    sendLog()
}

job.cancel()
job.join()
```

`launch` 返回 `Job`，代表这个协程任务本身，可以取消、等待完成、查询状态。适合发起后台任务、收集 Flow、处理事件这类"不需要拿返回值"的场景。

### async：启动一个会返回结果的协程

```kotlin
val deferred: Deferred<User> = scope.async {
    fetchUser()
}

val user = deferred.await()
```

`Deferred<T>` 是带结果的 `Job`，可以类比其他语言里的 Promise / Future。

并发拉两个接口的标准写法：

```kotlin
coroutineScope {
    val user = async { fetchUser() }
    val orders = async { fetchOrders() }

    user.await() to orders.await()
}
```

在默认的 `CoroutineStart.DEFAULT` 下，两个 `async` 创建后就会被调度执行，`await()` 负责等待并取得结果，所以总耗时接近较慢的那个，而不是两者之和。如果显式使用 `CoroutineStart.LAZY`，则要到 `start()` 或 `await()` 时才启动。

### coroutineScope：等所有子协程结束

```kotlin
suspend fun loadPage() = coroutineScope {
    val a = async { loadA() }
    val b = async { loadB() }
    Page(a.await(), b.await())
}
```

`coroutineScope {}` 创建一个新的子作用域，并挂起等待里面所有子协程结束——它本身是挂起而非阻塞线程。它给出的保证很有价值：**函数返回时，里面启动的协程一定都已经结束了**，不会有漏在外面继续跑的任务。

### Job 的父子关系

在一个协程里启动的协程，默认是它的子协程：

```kotlin
scope.launch {
    launch {
        work()
    }
}
```
关系是双向的：外层取消，内层跟着取消；内层失败（非 `CancellationException` 的未处理异常），默认会取消整个作用域并把异常传给外层。并发代码因此有了清晰的生命周期，也就不容易出现"没人管的任务泄漏"。

## 四、取消是协作式的

协程取消并非强制 kill 线程，而是协作式地传播取消信号。协程通常会在**可取消的挂起点**，或者显式调用 `ensureActive()`、检查 `isActive` 时观察到取消。协程库中常见的挂起操作通常都支持取消，例如：

```kotlin
delay()
withContext()
collect()
await()
join()
```

并不是所有 `suspend fun` 都天然支持取消；是否响应取消取决于具体实现。`withContext(NonCancellable)` 就是刻意屏蔽取消的例子，自定义挂起函数也需要使用可取消的原语才能及时响应取消。

如果写的是纯 CPU 密集循环，中间没有任何挂起点，就必须自己检查：

```kotlin
// 在 CoroutineScope 作用域内（launch/async/coroutineScope 的 lambda 里）
while (isActive) {
    doSmallWork()
}
```

注意 `isActive` 是 `CoroutineScope` 的扩展属性。在普通的 `suspend fun` 里没有 scope 接收者，要改成：

```kotlin
suspend fun crunch() {
    while (currentCoroutineContext().isActive) {
        doSmallWork()
    }
}

// 或者直接让它抛出，语义更明确
suspend fun crunch2() {
    while (true) {
        currentCoroutineContext().ensureActive()
        doSmallWork()
    }
}
```

取消通过抛出 `CancellationException` 来传播，所以不要把它吞掉：

```kotlin
try {
    doWork()
} catch (e: CancellationException) {
    throw e          // 取消必须继续向上传播
} catch (e: Exception) {
    handle(e)        // 真正的失败才在这里处理
}
```

`CancellationException` 在协程体系里表示"正常终止"，而不是需要转换成业务错误的失败，一旦被 catch 住则不再抛出，父协程会认为这个子协程顺利完成了。需要注意的是：如果当前 Job 已经进入取消状态，catch 住一次异常并不会让 Job 重新变成 active；问题主要在于代码可能忽略取消并继续运行，而不是父协程必然会把它当成成功。

同理，`catch (e: Exception)` 这种宽泛捕获会连带捕获 `CancellationException`，这也是上面要先单独处理它的原因。

清理逻辑如果本身需要调用可取消的挂起函数，需要放进 `NonCancellable`，否则协程已处于取消状态，后续可取消的挂起调用会立刻再抛出 `CancellationException`：

```kotlin
finally {
    withContext(NonCancellable) {
        delay(50)
        cleanup()
    }
}
```

## 五、Dispatcher 与 CoroutineContext

### Dispatcher 决定跑在哪个线程

```kotlin
Dispatchers.Default // CPU 密集计算，线程数约等于 CPU 核数
Dispatchers.IO      // 文件、网络、数据库等阻塞 IO，线程池可弹性扩张
Dispatchers.Main    // UI 主线程；需要平台实现，如 Android 或 Swing 的 artifact
```

切换线程池用 `withContext`：

```kotlin
withContext(Dispatchers.IO) {
    readFile()
}
```

`withContext` 是挂起函数：它带着新的上下文执行这段代码，结束后回到原来的上下文继续，返回值就是 lambda 的结果。

### CoroutineContext 是协程自身的配置信息

`CoroutineContext` 是一组元素的集合，常见的有：

```kotlin
Job                     // 生命周期与父子关系
ContinuationInterceptor // 通常就是 Dispatcher
CoroutineName           // 调试用的名字
CoroutineExceptionHandler
ThreadContextElement    // 比如 MDC、ThreadLocal 传递
```

用 `+` 组合，用索引取值：

```kotlin
launch(Dispatchers.IO + CoroutineName("agent-run")) {
    val name = currentCoroutineContext()[CoroutineName]?.name
}
```

这一点在后面的实验里很关键：**上下文由真正执行协程的那一方决定**。同一个 `flow {}` 被不同协程 collect，里面读到的 `CoroutineName` 是不一样的，凡是依赖上下文来读取配置的逻辑，必须放在运行时而不是构建时。

### runBlocking 是同步世界的桥

```kotlin
fun main() = runBlocking {
    val result = fetchUser()
    println(result)
}
```

它会**阻塞当前线程**直到内部协程执行完毕。适合 `main` 函数、临时脚本，以及确实需要同步桥接的代码；协程测试通常更推荐 `runTest`。尤其不能出现在 UI 线程或服务请求线程上，特定条件下还可能造成死锁。

不过通常情况下，应该也没有人会这么做。

![呆萌](./images/images1.jpg){width=20%}

应该没有吧。

## 六、Flow：异步的多个值

### 一个值 vs 一串值

`suspend fun` 通常返回一个最终结果，`Flow<T>` 可以随时间产生零个、一个或多个值：

```kotlin
suspend fun run(): AgentResult      // 一个结果
fun stream(): Flow<AgentEvent>      // 一串事件
```

流式输出天然适合 Flow，比如一个 Agent 的事件序列：

```kotlin
TextDelta("你")
TextDelta("好")
ToolCallRequested(...)
Completed(...)
```

`Flow` 接口本身并不保证数据源一定是冷的还是热的。下面先讲最常见的 `flow {}` 冷流；后面的 `SharedFlow`、`StateFlow` 则是热流。

### 冷流：创建不等于执行

`flow {}` 构建出来的是**冷流**，构建时不执行任何代码，只有 `collect` 时才真正运行：

```kotlin
val f = flow {
    println("start")
    emit(1)
}

println("created")
f.collect { println(it) }
```

输出顺序是：

```text
created
start
1
```

推论有两个，都很重要：

第一，拿到 Flow 对象不代表任务已经启动。

```kotlin
val events = agent.stream("hi")   // 什么都还没发生
events.collect { println(it) }    // 到这里才真正启动
```

第二，**每次 `collect` 都会把 flow block 重新执行一遍**。冷流不是"一份结果的多个订阅者"，而是"一份可以反复拉取的订阅"。对于带网络请求或副作用的 Flow，这也意味着重复 collect 通常会重新执行请求或副作用。

### emit 与 collect

生产端用 `emit` 往下游发值，消费端用 `collect` 接收：

```kotlin
flow {
    emit(1)
    emit(2)
}.collect { value ->
    println(value)
}
```

`collect` 是 `suspend`，因为收集过程可能持续很久，也可能在等上游产生数据。

### emitAll 转发另一个 Flow

`emitAll(otherFlow)` 把另一个 Flow 的所有值原样转发到当前 Flow：

```kotlin
flow {
    emitAll(innerFlow)
}

// 语义等价于
flow {
    innerFlow.collect { value ->
        emit(value)
    }
}
```

`emitAll` 是 `flow.collect { value -> emit(value) }` 的标准简写。它直接表达“把这个 Flow 原样转发给当前 collector”的意图，因此纯转发场景优先使用它。

于是开头那段经过简化的 Koaks 代码就好读了：

```kotlin
fun stream(input: String): Flow<AgentEvent> = flow {
    emitAll(runner.stream(initialMessages(input)))
}
```

它的完整含义是：等到有人 collect 时，才在**直接收集该 Flow 的协程上下文**里挂起构建 initial messages，然后开始收集 runner 的流，把 runner 产生的事件逐个转发出去。如果外层还有 Runtime、`channelFlow` 或 `flowOn`，这个直接 collector 的上下文不一定就是最终 API 调用方的上下文。

### 为什么 stream() 通常不是 suspend

因为构建 Flow 不应该执行任务，只应该描述任务。

```kotlin
fun stream(): Flow<Event>          // 惯例写法
suspend fun stream(): Flow<Event>  // 语义别扭, 仅在调用阶段本身需要挂起工作时才合适
```

后者的问题在于：调用 `stream()` 就已经要求调用方处在协程里，可是返回的冷流一行都还没跑。如果 API 的意图是把工作推迟到每次收集，真正的挂起过程就应该发生在 `stream().collect { ... }`。

那如果构建初始状态的过程本身需要挂起呢？如果希望它在**每次 collect 时**重新执行，就可以把它放进 `flow {}` 内部，函数签名仍然保持非 suspend。这样既符合冷 Flow 的惯例，也让初始化逻辑读取到运行时的直接 collector 上下文。

这不是语言层面的硬规则。如果 API 有意在调用 `stream()` 时只执行一次挂起初始化、固定一份快照，再把后续数据表示成 Flow，那么 `suspend fun stream(): Flow<Event>` 也可以有合理语义。两种写法的关键差异是：工作发生在调用时还是收集时，以及重复 collect 是否应该重复初始化。

### 热流：SharedFlow 与 StateFlow

冷流的对立面是热流。`MutableSharedFlow` 的生产者独立运行，不等 collector 出现：

```kotlin
val bus = MutableSharedFlow<Int>(replay = 0)
```

`replay = 0` 意味着不缓存历史值，此时如果没有任何订阅者，`emit` 出去的值直接被丢弃，这意味着晚到的 collector 收不到它错过的那些值。`StateFlow` 则始终持有当前值，新订阅者立刻拿到最新状态。

“热”描述的是数据源的生命周期独立于某一次 collect，并不表示 `emit` 永远不会挂起；有订阅者时是否挂起还取决于 replay、额外缓冲和溢出策略。

## 七、异常与失败传播

在普通的结构化并发作用域中，子协程抛出未处理的非取消异常时，默认会取消父协程；父协程随后会取消其他子协程。等所有子协程完成清理后，`coroutineScope` 会把异常继续向外抛出。

```kotlin
try {
    coroutineScope {
        launch {
            delay(100)
            error("boom")
        }

        launch {
            try {
                delay(1_000)
            } finally {
                println("兄弟协程被取消")
            }
        }
    }
} catch (e: IllegalStateException) {
    println("捕获异常：${e.message}")
}
```

`launch` 和 `async` 的区别主要在于如何取得结果和观察异常，而不是它们在普通父 Job 下是否传播失败。

`async` 会把结果或异常保存在 `Deferred` 中，`await()` 会返回结果或重新抛出异常。但在普通的结构化并发作用域中，`async` 一旦失败，也会立即取消父作用域，并不是只要不调用 `await()` 就没事：

```kotlin
coroutineScope {
    val deferred = async {
        error("boom")
    }

    deferred.await() // 重新抛出 Deferred 中保存的异常
}
```

需要注意：即使在 `await()` 外层加上 `try/catch`，普通父作用域也已经因为子协程失败而进入取消状态，通常不能靠捕获 `await()` 的异常来恢复整个作用域。

如果希望一个子协程失败后，兄弟协程仍然继续运行，可以使用 `supervisorScope`，或者让多个协程拥有同一个 `SupervisorJob` 作为父 Job：

```kotlin
supervisorScope {
    val bad = async {
        delay(100)
        error("bad child failed")
    }

    val good = async {
        delay(300)
        "good result"
    }

    try {
        bad.await()
    } catch (e: IllegalStateException) {
        println("bad 失败：${e.message}")
    }

    println(good.await())
}
```

在这个例子中，`bad` 的失败不会自动取消 `good`。不过必须在 `await()` 处处理异常：如果让 `bad.await()` 的异常直接从 `supervisorScope` 代码块中抛出，它就会变成 supervisorScope 自身的失败，进而取消其他子协程并继续向外传播。

对于 supervisor 下的 `launch`，因为它没有 `await()`，未捕获异常通常会交给 `CoroutineExceptionHandler` 或平台的未捕获异常处理器：

```kotlin
val handler = CoroutineExceptionHandler { _, e ->
    println("launch 失败：${e.message}")
}

supervisorScope {
    launch(handler) {
        error("boom")
    }

    launch {
        delay(300)
        println("兄弟协程继续执行")
    }
}
```

主要区别在子协程失败的传播方向：`coroutineScope` 里子协程失败会向上取消整个作用域，`supervisorScope` 里某个子协程失败不会自动取消它的兄弟协程。`async` 的失败通常由调用方在 `await()` 处处理；`launch` 没有 `await()`，其未捕获异常仍需要合适的异常处理策略。`supervisorScope` 自身代码块抛出的异常则仍会取消其子协程并向外传播。

## 八、可用来验证的代码

上面所有结论都可以用一个程序跑出来。这段代码覆盖 suspend、Job 与取消、async 并发、Dispatcher 切换、冷流、手动转发、`flowOn`、失败传播、Flow 取消、热流共十一个场景。

```kotlin
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import kotlin.system.measureTimeMillis

fun section(title: String) {
    println("\n=== $title ===")
}

suspend fun logC(message: String) {
    val name = currentCoroutineContext()[CoroutineName]?.name ?: "no-name"
    println("[${Thread.currentThread().name}][$name] $message")
}

suspend fun fakeNetwork(name: String, ms: Long): String {
    logC("$name 开始")
    delay(ms)
    logC("$name 结束")
    return "$name-result"
}

suspend fun buildInitialMessages(input: String): List<String> {
    val name = currentCoroutineContext()[CoroutineName]?.name ?: "no-name"
    logC("buildInitialMessages：开始解析 dynamic instructions")
    delay(100)
    return listOf(
        "system：在 coroutine=$name 中解析",
        "user：$input",
    )
}

fun runnerStream(initial: List<String>): Flow<String> = flow {
    logC("runnerStream 启动，initial=$initial")
    emit("Started")
    repeat(3) { i ->
        delay(120)
        emit("TextDelta-${i + 1}")
    }
    emit("Completed")
}

// 纯转发：用 emitAll 就够了
fun agentStyleStream(input: String): Flow<String> = flow {
    logC("进入外层 flow")

    // 这个 suspend 调用被推迟到 collect 时才执行
    val initial = buildInitialMessages(input)

    emitAll(runnerStream(initial))
}

// 需要在转发过程中夹带副作用：手动 collect
fun observedStyleStream(input: String): Flow<String> = flow {
    val initial = buildInitialMessages(input)
    val buffer = mutableListOf<String>()

    runnerStream(initial).collect { event ->
        buffer += event
        logC("转发前观察 event：$event")
        emit(event)
    }

    logC("stream 结束后，提交缓存的 events，数量=${buffer.size}")
}
```

主函数把十一个场景依次跑一遍：

```kotlin
fun main() = runBlocking(CoroutineName("main-scope")) {
    section("1. suspend：顺序写法，但 delay 不阻塞线程")
    val a = fakeNetwork("profile", 200)
    val b = fakeNetwork("settings", 200)
    logC("顺序执行结果 = $a + $b")

    section("2. launch + Job + cancellation")
    val ticker: Job = launch(CoroutineName("ticker")) {
        try {
            var i = 0
            while (isActive) {
                delay(100)
                logC("tick ${++i}")
            }
        } catch (e: CancellationException) {
            logC("ticker 收到 cancellation，继续向上抛出")
            throw e
        } finally {
            withContext(NonCancellable) {
                delay(50)
                logC("ticker 清理完成")
            }
        }
    }

    delay(260)
    logC("取消 ticker")
    ticker.cancelAndJoin()
    logC("ticker 是否已取消 = ${ticker.isCancelled}")

    section("3. async：并发执行并拿到结果")
    val took = measureTimeMillis {
        coroutineScope {
            val user = async(CoroutineName("load-user")) { fakeNetwork("user", 300) }
            val orders = async(CoroutineName("load-orders")) { fakeNetwork("orders", 300) }
            logC("await 结果 = ${user.await()} + ${orders.await()}")
        }
    }
    logC("并发耗时约 ${took}ms")

    section("4. withContext + Dispatchers")
    val sum = withContext(Dispatchers.Default + CoroutineName("cpu-pool")) {
        logC("在 Dispatchers.Default 上做 CPU 计算")
        (1..1_000_000).sumOf { it.toLong() }
    }
    logC("sum = $sum")

    section("5. Cold Flow：创建 Flow 不会立刻执行")
    val events: Flow<String> = agentStyleStream("hello")
    logC("Flow 对象已创建；flow 里面的代码还没有运行")
    delay(200)

    logC("开始 collect #1")
    events.collect { logC("collector #1 收到：$it") }

    logC("开始 collect #2，使用另一个 CoroutineName")
    withContext(CoroutineName("second-collector")) {
        events.collect { logC("collector #2 收到：$it") }
    }

    section("6. 需要夹带副作用时，手动 collect 转发")
    observedStyleStream("needs-memory-commit").collect { logC("外层 collector 收到：$it") }

    section("7. flowOn：改变上游，不改变下游 collector")
    val numbers = flow {
        logC("emit 1"); emit(1)
        logC("emit 2"); emit(2)
    }
        .map { logC("map $it"); it * 10 }
        .flowOn(Dispatchers.Default + CoroutineName("upstream-flow"))

    numbers.collect { logC("collect value = $it") }

    section("8. coroutineScope：一个 child 失败会取消兄弟协程")
    try {
        coroutineScope {
            launch(CoroutineName("failing-child")) {
                delay(100)
                error("boom")
            }
            launch(CoroutineName("sibling-child")) {
                try {
                    repeat(10) { i ->
                        delay(50)
                        logC("sibling 仍在工作 $i")
                    }
                } finally {
                    logC("sibling 进入 finally；是否已取消 = ${!isActive}")
                }
            }
        }
    } catch (e: IllegalStateException) {
        logC("parent 捕获到 child 失败：${e.message}")
    }

    section("9. supervisorScope：一个 child 失败不会取消兄弟协程")
    supervisorScope {
        val bad = async(CoroutineName("bad-child")) {
            delay(100)
            error("bad child failed")
        }
        val good = async(CoroutineName("good-child")) { fakeNetwork("good child", 250) }

        try {
            bad.await()
        } catch (e: IllegalStateException) {
            logC("bad 失败了，但 supervisor 让兄弟协程继续运行：${e.message}")
        }
        logC("good 结果 = ${good.await()}")
    }

    section("10. Flow 的 collect 可以被取消")
    val endless = flow {
        repeat(100) { i ->
            delay(100)
            emit(i)
        }
    }
    val collector = launch(CoroutineName("flow-collector")) {
        endless.collect { logC("endless flow value = $it") }
    }
    delay(260)
    collector.cancelAndJoin()
    logC("flow collector 已取消")

    section("11. Hot Flow：SharedFlow 的 producer 独立运行")
    val bus = MutableSharedFlow<Int>(replay = 0)
    val producer = launch(CoroutineName("hot-producer")) {
        repeat(3) { i ->
            delay(80)
            logC("hot emit $i")
            bus.emit(i)
        }
    }

    delay(130)
    val lateCollector = launch(CoroutineName("late-collector")) {
        bus.collect { logC("late collector 收到：$it") }
    }

    producer.join()
    delay(100)
    lateCollector.cancelAndJoin()

    section("done")
}
```

运行输出：

```text
=== 1. suspend：顺序写法，但 delay 不阻塞线程 ===
[main][main-scope] profile 开始
[main][main-scope] profile 结束
[main][main-scope] settings 开始
[main][main-scope] settings 结束
[main][main-scope] 顺序执行结果 = profile-result + settings-result

=== 2. launch + Job + cancellation ===
[main][ticker] tick 1
[main][ticker] tick 2
[main][main-scope] 取消 ticker
[main][ticker] ticker 收到 cancellation，继续向上抛出
[main][ticker] ticker 清理完成
[main][main-scope] ticker 是否已取消 = true

=== 3. async：并发执行并拿到结果 ===
[main][load-user] user 开始
[main][load-orders] orders 开始
[main][load-user] user 结束
[main][load-orders] orders 结束
[main][main-scope] await 结果 = user-result + orders-result
[main][main-scope] 并发耗时约 314ms

=== 4. withContext + Dispatchers ===
[DefaultDispatcher-worker-1][cpu-pool] 在 Dispatchers.Default 上做 CPU 计算
[main][main-scope] sum = 500000500000

=== 5. Cold Flow：创建 Flow 不会立刻执行 ===
[main][main-scope] Flow 对象已创建；flow 里面的代码还没有运行
[main][main-scope] 开始 collect #1
[main][main-scope] 进入外层 flow
[main][main-scope] buildInitialMessages：开始解析 dynamic instructions
[main][main-scope] runnerStream 启动，initial=[system：在 coroutine=main-scope 中解析, user：hello]
[main][main-scope] collector #1 收到：Started
[main][main-scope] collector #1 收到：TextDelta-1
[main][main-scope] collector #1 收到：TextDelta-2
[main][main-scope] collector #1 收到：TextDelta-3
[main][main-scope] collector #1 收到：Completed
[main][main-scope] 开始 collect #2，使用另一个 CoroutineName
[main][second-collector] 进入外层 flow
[main][second-collector] buildInitialMessages：开始解析 dynamic instructions
[main][second-collector] runnerStream 启动，initial=[system：在 coroutine=second-collector 中解析, user：hello]
[main][second-collector] collector #2 收到：Started
[main][second-collector] collector #2 收到：TextDelta-1
[main][second-collector] collector #2 收到：TextDelta-2
[main][second-collector] collector #2 收到：TextDelta-3
[main][second-collector] collector #2 收到：Completed

=== 6. 需要夹带副作用时，手动 collect 转发 ===
[main][main-scope] buildInitialMessages：开始解析 dynamic instructions
[main][main-scope] runnerStream 启动，initial=[system：在 coroutine=main-scope 中解析, user：needs-memory-commit]
[main][main-scope] 转发前观察 event：Started
[main][main-scope] 外层 collector 收到：Started
[main][main-scope] 转发前观察 event：TextDelta-1
[main][main-scope] 外层 collector 收到：TextDelta-1
[main][main-scope] 转发前观察 event：TextDelta-2
[main][main-scope] 外层 collector 收到：TextDelta-2
[main][main-scope] 转发前观察 event：TextDelta-3
[main][main-scope] 外层 collector 收到：TextDelta-3
[main][main-scope] 转发前观察 event：Completed
[main][main-scope] 外层 collector 收到：Completed
[main][main-scope] stream 结束后，提交缓存的 events，数量=5

=== 7. flowOn：改变上游，不改变下游 collector ===
[DefaultDispatcher-worker-1][upstream-flow] emit 1
[DefaultDispatcher-worker-1][upstream-flow] map 1
[DefaultDispatcher-worker-1][upstream-flow] emit 2
[DefaultDispatcher-worker-1][upstream-flow] map 2
[main][main-scope] collect value = 10
[main][main-scope] collect value = 20

=== 8. coroutineScope：一个 child 失败会取消兄弟协程 ===
[main][sibling-child] sibling 仍在工作 0
[main][sibling-child] sibling 进入 finally；是否已取消 = true
[main][main-scope] parent 捕获到 child 失败：boom

=== 9. supervisorScope：一个 child 失败不会取消兄弟协程 ===
[main][good-child] good child 开始
[main][main-scope] bad 失败了，但 supervisor 让兄弟协程继续运行：bad child failed
[main][good-child] good child 结束
[main][main-scope] good 结果 = good child-result

=== 10. Flow 的 collect 可以被取消 ===
[main][flow-collector] endless flow value = 0
[main][flow-collector] endless flow value = 1
[main][main-scope] flow collector 已取消

=== 11. Hot Flow：SharedFlow 的 producer 独立运行 ===
[main][hot-producer] hot emit 0
[main][hot-producer] hot emit 1
[main][late-collector] late collector 收到：1
[main][hot-producer] hot emit 2
[main][late-collector] late collector 收到：2

=== done ===
```

## 九、逐段读日志

### 并发不等于多线程

第 2、3 段的所有输出都带着 `[main]` 前缀：

```text
[main][load-user] user 开始
[main][load-orders] orders 开始
```

两个 `async` 在同一个线程上并发执行：当其中一个协程在 `delay()` 处挂起时，`runBlocking` 的事件循环可以在同一个 `main` 线程上运行另一个协程。两个任务各等 300ms，总耗时接近 300ms，而不是 600ms。

这条结论可以单独记住：**协程是并发模型，不是线程模型**。协程在哪个线程执行、恢复后是否可能换到另一个工作线程，由它的 Dispatcher 决定；Dispatcher 既可能显式指定，也可能从父上下文继承。第 4 段显式切到 `Dispatchers.Default`，所以出现了工作线程：

```text
[DefaultDispatcher-worker-1][cpu-pool] 在 Dispatchers.Default 上做 CPU 计算
```

顺带一个细节：第 1 段的 `profile` 和 `settings` 是串行的，因为它们只是普通的挂起调用，前一个不结束后一个不开始。在这种需要同时取得两个返回值的场景里，可以用 `coroutineScope` 配合 `async` 显式表达并发。

### 取消走的是协作路径

第 2 段完整展示了取消链：

```text
[main][main-scope] 取消 ticker
[main][ticker] ticker 收到 cancellation，继续向上抛出
[main][ticker] ticker 清理完成
[main][main-scope] ticker 是否已取消 = true
```

`cancelAndJoin()` 先把 ticker 的 Job 标记为取消；正挂在 `delay(100)` 上的协程随后收到 `CancellationException`。catch 块记录日志并重新抛出，避免把取消当成普通失败后继续执行；`finally` 里的清理靠 `NonCancellable` 才能顺利完成那次 `delay(50)`。最终 `isCancelled` 为 `true`，主要是因为这个 Job 已经被显式取消，而重新抛出保证了代码不会忽略该取消并继续正常路径。

### 冷流的两个特征都被验证了

第 5 段先创建 Flow，再等 200ms，日志里始终只有一行：

```text
[main][main-scope] Flow 对象已创建；flow 里面的代码还没有运行
```

`进入外层 flow` 和 `buildInitialMessages` 直到 `collect` 才出现。**创建不执行**成立。

接着连续 collect 两次，`buildInitialMessages` 执行了两次，**每次 collect 都重跑一遍 flow block**。更有意思的是两次读到的名字不同：

```text
initial=[system：在 coroutine=main-scope 中解析, user：hello]
initial=[system：在 coroutine=second-collector 中解析, user：hello]
```

第二次被 `withContext(CoroutineName("second-collector"))` 包住，flow 内部就读到了新名字。这正好印证了前面那条：默认情况下，flow block 跑在直接 collector 的上下文里。因此，如果某段配置有意按每次 collect 的执行现场解析，就应该把它放在 `flow {}` 内部；放在构建 Flow 之前，得到的则是构建阶段的值和上下文。若使用 `flowOn` 或额外的 Runtime，这个“执行现场”还会由相应的上游或运行时上下文决定。

### emitAll 还是手动 collect

第 5 段是纯转发，`emitAll(runnerStream(initial))` 就够了。

第 6 段要在转发途中观察每个事件、攒进 buffer、结束后统一提交，日志呈现出清晰的交替：

```text
转发前观察 event：Started
外层 collector 收到：Started
转发前观察 event：TextDelta-1
外层 collector 收到：TextDelta-1
...
stream 结束后，提交缓存的 events，数量=5
```

这个交替顺序说明上游 emit 和下游处理是同一个协程里的直接调用链，没有缓冲，`emit` 会一直挂着，直到下游的 collector lambda 返回。

需要副作用时也不是只有手动 collect 一种方式。如果副作用只针对每个元素，用操作符更简洁：

```kotlin
// 只想观察每个元素
emitAll(runnerStream(initial).onEach { logC("观察：$it") })

// 还需要在结束后做一次提交
emitAll(
    runnerStream(initial)
        .onEach { buffer += it }
        .onCompletion { cause ->
            if (cause == null) logC("正常结束，提交，数量=${buffer.size}")
        }
)
```

需要过滤、截断或重塑流时，通常优先使用 `filter`、`transform`、`takeWhile`、`transformWhile` 等操作符。手动 `collect { emit(...) }` 更适合确实需要命令式状态管理、按条件发出多个事件，或在收集完成后继续处理局部状态的场景。不能依赖普通的 `return` 从 `collect` lambda 中提前结束外层 Flow；`return@collect` 只会跳过当前元素。纯粹的旁路观察交给 `onEach` / `onCompletion` 会更易读。

### flowOn 只改上游

第 7 段：

```text
[DefaultDispatcher-worker-1][upstream-flow] emit 1
[DefaultDispatcher-worker-1][upstream-flow] map 1
[DefaultDispatcher-worker-1][upstream-flow] emit 2
[DefaultDispatcher-worker-1][upstream-flow] map 2
[main][main-scope] collect value = 10
[main][main-scope] collect value = 20
```

`flowOn(...)` 改变的是它**上游**的执行上下文，包括 `flow {}` 和 `map {}`；下游的 `collect {}` 仍然留在原来的 `main-scope`。这也是 Flow 的上下文保持原则：collector 的上下文由 collector 自己决定，上游无权更改，要改就得显式用 `flowOn`。

另外注意上游两轮 `emit/map` 连续跑完，下游才开始收——`flowOn` 会引入异步边界和一个默认容量的缓冲，上下游不再严格一步一贴。这个交错顺序取决于调度时机，多跑几次可能看到不同的排列，不要把它当成稳定契约。

### 失败往哪里传播

第 8 段的两行日志说明了 `coroutineScope` 的行为：

```text
[main][sibling-child] sibling 仍在工作 0
[main][sibling-child] sibling 进入 finally；是否已取消 = true
[main][main-scope] parent 捕获到 child 失败：boom
```

`sibling` 只打印了一次就进 `finally`，且 `isActive` 已经是 `false`——`failing-child` 在 100ms 时抛出异常，直接取消了整个作用域，包括本来还要循环 10 次的兄弟协程。异常最后由 `coroutineScope` 重新抛给调用方，被外层 `try/catch` 接住。

第 9 段换成 `supervisorScope`，结果完全不同：

```text
[main][good-child] good child 开始
[main][main-scope] bad 失败了，但 supervisor 让兄弟协程继续运行：bad child failed
[main][good-child] good child 结束
[main][main-scope] good 结果 = good child-result
```

`bad-child` 失败没有波及 `good-child`，后者跑完 250ms 正常返回结果。这里的 `bad-child` 是 supervisor 下的 `async`，它的异常保存在 `Deferred` 中，因此调用方需要在 `await()` 处自行 `try/catch` 处理

### collect 可以被取消

第 10 段里，`endless` 流本该发 100 个值，但 collector 在 260ms 时被取消，只收到了 0 和 1。这里能及时停止是因为 `delay` 是可取消的挂起函数，并且 `flow {}` 构建的流默认会在发射过程中检查取消。取消 collector 所在的 Job 后，取消信号沿收集调用链传到上游，整个生产过程随之终止。

### 热流不等 collector

第 11 段：

```text
[main][hot-producer] hot emit 0
[main][hot-producer] hot emit 1
[main][late-collector] late collector 收到：1
[main][hot-producer] hot emit 2
[main][late-collector] late collector 收到：2
```

`lateCollector` 在 130ms 才启动，`0` 已经在 80ms 时发出去了。因为 `replay = 0` 且当时没有任何订阅者，那个值直接被丢弃，不存在"以后补发"。producer 的生命周期独立于这次 collect，不关心有没有订阅者，这也正是热流与冷流最显著的差别。

## 十、总结

理解 Kotlin 协程的三层心智模型，足够应付大部分协程代码：

- **`suspend`**：这个函数可能暂停并稍后恢复，挂起不是阻塞线程。

- **`Scope` + `Job`**：协程有生命周期和父子关系，能够统一取消；`coroutineScope` 与 `supervisorScope` 的主要区别在失败的传播方向：子协程失败是否会自动取消兄弟协程和整个作用域。

- **`Flow`**：可以表示随时间产生的多个值；`flow {}` 创建的通常是冷流，`collect` 时才开始执行，`emit` 逐个发值；`flowOn` 改变上游上下文，`SharedFlow` / `StateFlow` 是热流。

再回到开头那段 `Koaks` 的代码：

```kotlin
fun stream(input: String): Flow<AgentEvent> = flow {
    emitAll(runner.stream(initialMessages(input)))
}
```

现在它的每个设计选择都有了理由。调用 `stream(input)` 只创建一个冷流，不做实际的 Agent 执行；等这个 Flow 被 collect 时，才进入协程环境，在 collector 的上下文里挂起执行 `initialMessages(input)`，然后 `collect` 内部的 `runner flow`，把所有 `AgentEvent` 原样转发给调用方。

签名保持非 `suspend`，是因为构建流不该执行任务，避免在订阅者还未就绪的情况下产生元素，对Agent来讲丢 `Event` 意味着丢信息，这是不可接受的。挂起的初始化放进 `flow {}` 内部，是因为它需要读取真正执行时的上下文。

在当前 Koaks 版本中，公开的 `Agent.stream` 会先进入 `AgentRuntime`，所以这里的“直接 collector 上下文”通常是 Runtime 内部执行协程的上下文，而不是最终用户调用 `collect` 的上下文。Flow 的原理没有变化，变化的是哪一层协程实际承担收集和执行。
