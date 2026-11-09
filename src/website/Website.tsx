import { useEffect, useState } from 'react';
import { ArrowUpRight, Download, ExternalLink, Menu, X } from 'lucide-react';
import { loadWebsiteContent, type WebsiteContent } from './content';
import './website.css';

export default function Website() {
  const [content, setContent] = useState<WebsiteContent>(loadWebsiteContent);
  const [active, setActive] = useState<'home'|'news'|'buy'|'about'>('home');
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { const onStorage = () => setContent(loadWebsiteContent()); window.addEventListener('storage', onStorage); return () => window.removeEventListener('storage', onStorage); }, []);
  const jump = (next: typeof active) => { setActive(next); setMobileOpen(false); document.getElementById(next)?.scrollIntoView({ behavior: 'smooth' }); };
  return <div className="site-shell">
    <header className="site-header"><a className="brand" href="#home" onClick={() => jump('home')}><span className="brand-mark">鲸</span><span>{content.logoText}</span></a><button className="mobile-menu" onClick={() => setMobileOpen(v => !v)} aria-label="打开菜单">{mobileOpen ? <X/> : <Menu/>}</button><nav className={mobileOpen ? 'open' : ''}><button onClick={() => jump('news')}>新闻</button><button onClick={() => jump('buy')}>购买</button><button onClick={() => jump('about')}>关于</button></nav><a className="header-download" href={content.downloadUrl}><Download size={16}/> {content.downloadLabel}</a></header>
    <main>
      <section id="home" className="hero"><div className="hero-copy"><p className="eyebrow">{content.eyebrow}</p><h1>{content.title}<br/><em>{content.titleAccent}</em></h1><p className="hero-subtitle">{content.subtitle}</p><div className="hero-actions"><a className="primary-button" href={content.downloadUrl}><Download size={19}/> {content.downloadLabel}</a><button className="text-button" onClick={() => jump('about')}>了解平台 <ArrowUpRight size={16}/></button></div></div><div className="hero-art" aria-label="交互平台预览"><div className="orbit orbit-a"/><div className="orbit orbit-b"/><div className="core-card"><span>JINGDONG</span><strong>互动 · 发生</strong><small>实时预览 / 交互叙事 / 专业导出</small></div></div></section>
      <section className="signal-row"><div><strong>实时</strong><span>预览每一次改变</span></div><div><strong>自由</strong><span>从想法到成片</span></div><div><strong>可靠</strong><span>授权与导出可追踪</span></div></section>
      <section id="news" className="section news-section"><div className="section-heading"><p className="eyebrow">LATEST / NEWS</p><h2>新鲜动态</h2><p>关于产品、版本与创作灵感的短消息。</p></div><div className="news-list">{content.news.map(item => <article key={item.id} className="news-item"><time>{item.date}</time><div><h3>{item.title}</h3><p>{item.summary}</p></div><button aria-label={`阅读${item.title}`}><ArrowUpRight size={20}/></button></article>)}</div></section>
      <section id="buy" className="buy-section"><div><p className="eyebrow">ACCESS / PURCHASE</p><h2>先下载，再决定你的下一步。</h2><p>鲸动交互平台支持免费体验。需要完整导出能力时，可使用注册码激活专业授权。</p></div><div className="buy-actions"><a className="primary-button" href={content.downloadUrl}><Download size={19}/> 下载客户端</a><a className="outline-button" href={content.licenseUrl}>注册码管理 <ExternalLink size={16}/></a></div></section>
      <section id="about" className="section about-section"><div className="about-number">01</div><div><p className="eyebrow">ABOUT / JINGDONG</p><h2>让复杂的交互，<br/>回到直觉。</h2><p>我们为视觉设计师、内容团队和教育创作者打造一套安静而有力量的工具。把画面、动作与反馈放在同一个工作台里，专注表达本身。</p></div></section>
    </main><footer><span>© 2026 {content.logoText}</span><span>交互内容创作平台</span><a href="/website-admin">内容管理</a></footer>
  </div>;
}
