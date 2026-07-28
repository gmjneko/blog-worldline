import {
  Badge,
  Button,
  CodePanel,
  FigureGrid,
  PageShell,
  RuleList,
  Section,
  SiteFooter,
  SiteHeader,
  Tabs,
  TerminalPanel,
} from './ui'
import './App.css'

const systemSamples = [
  {
    id: 'direction',
    label: 'direction',
    value: 'cat ./design-direction.txt',
  },
  {
    id: 'type',
    label: 'type',
    value: 'font-family: "IBM Plex Mono", monospace;',
  },
  {
    id: 'layout',
    label: 'layout',
    value: 'max-width: 1080px; padding-inline: 80px;',
  },
]

const principles = [
  {
    title: '单色系统',
    description: '用暖白、近黑和少量灰阶建立层级，让内容成为页面里最醒目的部分。',
  },
  {
    title: '严格网格',
    description: '页面、区块和组件共用同一组边界，留白不是装饰，而是结构的一部分。',
  },
  {
    title: '等宽排版',
    description: '文本保持技术文档般的秩序感，强调信息密度，而不是制造营销感。',
  },
  {
    title: '克制交互',
    description: '状态只通过颜色、边线和短距离变化表达，不使用夸张阴影与漂浮动画。',
  },
]

const terminalTasks = [
  {
    title: 'Layout',
    description: 'single shell / 1080px / thin rules',
  },
  {
    title: 'Typography',
    description: 'monospace / measured rhythm / quiet hierarchy',
  },
  {
    active: true,
    title: 'Rendering preview',
    description: 'light, responsive, content-first',
  },
]

const terminalContext = [
  {
    label: 'Context',
    values: ['4 constraints', '100% aligned'],
  },
  {
    label: 'Surface',
    values: ['web / responsive', 'theme / system'],
  },
]

const figures = [
  { pattern: 'lines' as const, value: '1080', label: '页面最大宽度' },
  { pattern: 'dots' as const, value: '01', label: '主强调颜色' },
  { pattern: 'bars' as const, value: '04', label: '基础间距单位' },
]

const navigation = [
  { href: '#top', label: 'Index' },
  { href: '#system', label: 'System' },
  { href: '#principles', label: 'Principles' },
  { href: '#about', label: 'About' },
]

function App() {
  return (
    <PageShell id="top">
      <SiteHeader
        brandLabel="Worldline 首页"
        navigation={navigation}
        action={{ href: '#system', label: '查看规范' }}
      />

      <Section
        id="system"
        variant="hero"
        headingLevel={1}
        eyebrow={
          <div className="announcement">
            <Badge>新</Badge>
            <p>这是一个用于检查视觉方向的单页原型。</p>
            <a href="#principles">查看系统</a>
          </div>
        }
        title="记录思考，而不是制造噪音。"
        description={
          <p className="hero-description">
            一个克制、清晰的数字空间。用严格的网格、等宽字体和有限的颜色，
            <br className="desktop-break" />
            让内容保持安静而有力量。
          </p>
        }
      >
        <Tabs
          ariaLabel="设计系统示例"
          items={systemSamples.map((sample) => ({
            id: sample.id,
            label: sample.label,
            content: <CodePanel code={sample.value} embedded />,
          }))}
        />
      </Section>

      <TerminalPanel
        aria-label="终端界面风格示例"
        title="worldline / visual-study"
        branch="main"
        prompt="inspect current direction"
        subtitle="Reading constraints and visual tokens…"
        tasks={terminalTasks}
        context={terminalContext}
      />

      <Section
        id="principles"
        title="什么构成了这种风格？"
        description="它不是一组装饰效果，而是一套持续限制视觉噪音的规则。"
      >
        <RuleList items={principles} />
        <Button className="section-button" href="#metrics">
          继续查看
        </Button>
      </Section>

      <Section
        id="metrics"
        title="一个有限的视觉系统"
        index="FIG. 01—03"
        description={
          <p className="indented-description">
            <span>[*]</span>
            通过少量可复用规则，让不同内容仍然保持同一种语气。
          </p>
        }
      >
        <FigureGrid items={figures} />
      </Section>

      <Section
        id="about"
        variant="split"
        title="只保留必要的信息"
        description={
          <p className="indented-description">
            <span>[*]</span>
            这个页面仅用于确认设计语言。目前没有文章、分类、搜索或内容系统。
          </p>
        }
        actions={
          <Button href="#top" variant="secondary">
            返回顶部
          </Button>
        }
      />

      <SiteFooter
        meta={
          <>
            <span>Visual direction study</span>
            <span>© 2026</span>
          </>
        }
      />
    </PageShell>
  )
}

export default App
