import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Bell, ChartNoAxesColumnIncreasing, Check, ChevronDown, CircleHelp, Home, Infinity as InfinityIcon, LayoutGrid, LockKeyhole, Menu, Search, Settings, UserRound, X } from 'lucide-react';
import { ModuleArtwork, type SuiteModuleId } from './ModuleArtwork';
import './suite.css';

export type SuitePage = 'home' | 'modules' | 'help';
export const SUITE_MODULES: { id: SuiteModuleId; name: string; title: string; description: string; available: boolean }[] = [
  { id: 'fact', name: 'FACT', title: 'Facturación electrónica', description: 'Prepara tus facturas, gestiona clientes y lleva el control de tus ventas, fácil y en un solo lugar.', available: true },
  { id: 'conta', name: 'CONTA', title: 'Contabilidad', description: 'Tu contabilidad al día, con una visión clara de las finanzas de tu negocio.', available: false },
  { id: 'stock', name: 'STOCK', title: 'Inventarios', description: 'Tus productos, existencias y movimientos, organizados en un mismo espacio.', available: false },
  { id: 'admin', name: 'ADMIN', title: 'Planillas y administración', description: 'Tu equipo, planillas y procesos administrativos, más simples y conectados.', available: false },
];

const navItems = [
  { href: '#/suite', label: 'Inicio', icon: Home, page: 'home' },
  { href: '#/modulos', label: 'Módulos', icon: LayoutGrid, page: 'modules' },
  { href: '#/libros-iva', label: 'Reportes', icon: ChartNoAxesColumnIncreasing, page: '' },
  { href: '#/configuracion', label: 'Configuración', icon: Settings, page: '' },
  { href: '#/ayuda', label: 'Ayuda', icon: CircleHelp, page: 'help' },
];

export function SuiteHome({ page }: { page: SuitePage }) {
  const [search, setSearch] = useState('');
  const [desktop, setDesktop] = useState(() => window.matchMedia?.('(min-width: 768px)').matches ?? true);
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [popover, setPopover] = useState<'news' | 'account' | null>(null);
  const headerActions = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const popoverTrigger = useRef<HTMLButtonElement | null>(null);
  const main = useRef<HTMLElement>(null);
  const query = search.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const modules = SUITE_MODULES.filter(module => (`sivar ${module.name} ${module.title} ${module.description}`).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(query));

  useEffect(() => {
    const media = window.matchMedia?.('(min-width: 768px)');
    if (!media) return;
    const onResize = () => { setDesktop(media.matches); setNavOpen(false); };
    media.addEventListener('change', onResize);
    return () => media.removeEventListener('change', onResize);
  }, []);
  useEffect(() => {
    document.title = `${page === 'help' ? 'Ayuda' : page === 'modules' ? 'Módulos' : 'Inicio'} · SIVAR SUITE`;
    setNavOpen(false); setPopover(null);
    main.current?.focus({ preventScroll: true });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [page]);
  useEffect(() => {
    if (!navOpen && !popover) return;
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setNavOpen(false); setPopover(null);
      (popover ? popoverTrigger.current : menuButton.current)?.focus();
    };
    const outside = (event: MouseEvent) => {
      if (popover && !headerActions.current?.contains(event.target as Node)) setPopover(null);
    };
    document.addEventListener('keydown', dismiss); document.addEventListener('mousedown', outside);
    return () => { document.removeEventListener('keydown', dismiss); document.removeEventListener('mousedown', outside); };
  }, [navOpen, popover]);
  const togglePopover = (name: 'news' | 'account', trigger: HTMLButtonElement) => {
    popoverTrigger.current = trigger;
    setPopover(previous => previous === name ? null : name);
  };

  return <div className={`suite-shell ${collapsed ? 'suite-collapsed' : ''} ${navOpen ? 'suite-nav-open' : ''}`}>
    <a className="suite-skip" href="#suite-content" onClick={event => { event.preventDefault(); main.current?.focus(); }}>Saltar al contenido</a>
    <header className="suite-header">
      <button ref={menuButton} className="suite-icon-button suite-menu-toggle" aria-label={desktop ? 'Contraer o ampliar navegación' : 'Abrir menú de la suite'} aria-expanded={desktop ? !collapsed : navOpen} aria-controls="suite-navigation" onClick={() => desktop ? setCollapsed(value => !value) : setNavOpen(value => !value)}>{navOpen && !desktop ? <X /> : <Menu />}</button>
      <a className="suite-wordmark" href="#/suite" aria-label="SIVAR SUITE · Inicio"><strong>SIVAR</strong><span>SUITE</span></a>
      <div className="suite-header-actions" ref={headerActions}>
        <label className="suite-search"><Search aria-hidden="true" /><input aria-label="Buscar módulos" placeholder="Buscar módulos…" value={search} onChange={event => { setSearch(event.target.value); if (page === 'help') window.location.hash = '/modulos'; }} /></label>
        <button className="suite-icon-button suite-news-button" aria-label="Novedades de la suite" aria-expanded={popover === 'news'} aria-controls="suite-news" onClick={event => togglePopover('news', event.currentTarget)}><Bell /></button>
        <button className="suite-account-button" aria-label="Acceso a mi cuenta" aria-expanded={popover === 'account'} aria-controls="suite-account" onClick={event => togglePopover('account', event.currentTarget)}><span><UserRound aria-hidden="true" /></span><ChevronDown className="suite-account-chevron" aria-hidden="true" /></button>
        {popover === 'news' && <section id="suite-news" aria-label="Novedades" className="suite-popover"><h2>Novedades de tu suite</h2><p><span className="suite-news-dot" />SIVAR FACT ya está disponible.</p><p>Contabilidad, Inventarios y Administración están en preparación. Aquí podrás conocer su disponibilidad.</p></section>}
        {popover === 'account' && <section id="suite-account" aria-label="Mi cuenta" className="suite-popover"><h2>Tu cuenta, en un solo lugar</h2><p>Accede a facturación para entrar a tu empresa o crear tu cuenta.</p><a href="#/inicio" className="suite-popover-link">Ir a SIVAR FACT <ArrowRight size={17} /></a></section>}
      </div>
    </header>

    {navOpen && !desktop && <button className="suite-nav-backdrop" aria-label="Cerrar menú de la suite" onClick={() => { setNavOpen(false); menuButton.current?.focus(); }} />}
    <aside className="suite-sidebar" id="suite-navigation" {...{ inert: !desktop && !navOpen ? '' : undefined }}>
      <nav aria-label="Navegación de la suite">{navItems.map(item => {
        const Icon = item.icon;
        return <a key={item.label} href={item.href} className={page === item.page ? 'suite-nav-active' : ''} aria-current={page === item.page ? 'page' : undefined} title={collapsed && desktop ? item.label : undefined} onClick={() => setNavOpen(false)}><Icon aria-hidden="true" /><span>{item.label}</span></a>;
      })}</nav>
      <div className="suite-sidebar-footer"><span className="suite-sidebar-symbol"><LayoutGrid /></span><span>Hecho para tu negocio.<br /><strong>Hecho en El Salvador.</strong></span></div>
    </aside>

    <main ref={main} id="suite-content" tabIndex={-1} className="suite-main">
      <section className="suite-hero" aria-labelledby="suite-title">
        <h1 id="suite-title"><strong>SIVAR</strong> <span>SUITE</span></h1>
        <h2>Todo tu negocio. Un solo ecosistema.</h2>
        <p>Facturación, contabilidad, inventarios, planillas y más, en un solo lugar.</p>
        <span className="suite-hero-rule" />
      </section>

      {page === 'help' ? <section className="suite-help" aria-labelledby="suite-help-title">
        <span className="suite-help-icon"><CircleHelp /></span><h2 id="suite-help-title">¿Por dónde empiezo?</h2>
        <p>Entra a SIVAR FACT para gestionar la facturación de tu negocio. Los otros tres módulos todavía no están disponibles.</p>
        <ol><li><strong>Entra a facturación.</strong> Inicia sesión con tu cuenta o explora los datos de demostración.</li><li><strong>Elige tu empresa.</strong> Revisa sus datos y registra tus clientes y productos.</li><li><strong>Prepara tu primera factura.</strong> Sigue el asistente y revisa el documento antes de guardarlo.</li></ol>
        <p className="suite-help-note">La versión actual permite preparar borradores. La firma y el envío oficial a Hacienda siguen pendientes.</p>
        <a href="#/inicio" className="suite-primary-link">Entrar a SIVAR FACT <ArrowRight size={18} /></a>
      </section> : <section className="suite-modules" aria-label="Módulos de SIVAR SUITE">
        {(page === 'modules' || query) && <div className="suite-modules-heading"><h2>Explora tus módulos</h2><span><span className="suite-available-dot" />Facturación disponible</span></div>}
        {query && <p role="status" className="suite-search-result">{modules.length} {modules.length === 1 ? 'módulo encontrado' : 'módulos encontrados'}</p>}
        <div className="suite-module-grid">{modules.map(module => <article key={module.id} className={`suite-card suite-card-${module.id}`} aria-labelledby={`module-title-${module.id}`} data-available={module.available}>
          <span className={`suite-card-status ${module.available ? 'suite-status-available' : ''}`}>{module.available ? <><Check size={12} /> Disponible</> : <><LockKeyhole size={11} /> Próximamente</>}</span>
          <ModuleArtwork module={module.id} />
          <div className="suite-card-body"><h3 id={`module-title-${module.id}`}><strong>SIVAR</strong> <span>{module.name}</span></h3><h4>{module.title}</h4><p>{module.description}</p>
            {module.available ? <a className="suite-card-action" href="#/inicio" aria-label="Entrar a SIVAR FACT">Entrar <ArrowRight size={19} /></a> : <button className="suite-card-action" disabled aria-label={`SIVAR ${module.name} · Próximamente`}><LockKeyhole size={15} />Próximamente</button>}
          </div>
        </article>)}</div>
        {!modules.length && <div className="suite-empty"><Search /><h3>No encontramos ese módulo</h3><p>Prueba con “facturación”, “contabilidad”, “inventarios” o “administración”.</p><button onClick={() => setSearch('')}>Mostrar todos los módulos</button></div>}
      </section>}

      <footer className="suite-footer"><div><InfinityIcon aria-hidden="true" /><span>Tu negocio conectado. <strong>Paso a paso.</strong></span></div><p>Hoy, facturación. Muy pronto, más posibilidades.</p></footer>
    </main>
  </div>;
}
