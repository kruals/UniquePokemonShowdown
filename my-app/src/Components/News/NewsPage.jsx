import React, { useState } from 'react';

// ── ДАННЫЕ — редактируй здесь ─────────────────────────────────
const CONTACTS = [
  { icon: '💬', label: 'Discord', value: 'Kruals1234', href: 'https://discord.com/users/yourname' },
  { icon: '🐙', label: 'GitHub',  value: 'github.com/kruals', href: 'https://github.com/kruals/UniquePokemonShowdown' },
  { icon: '📱', label: 'Telegram',value: '@kruals', href: 'https://t.me/kruals' },
];

const PATCHES = [
  {
    version: '0.4.2',
    date: '10 марта 2026',
    type: 'hotfix',
    title: 'Хотфикс Z-атак и тултипов',
    changes: [
      { tag: 'fix',  text: 'Исправлена логика Z-кристаллов — совместимость теперь проверяется по типу атаки' },
      { tag: 'fix',  text: 'Тултипы иконок команды теперь корректно отображают статы и атаки' },
      { tag: 'fix',  text: 'Мега-форма больше не остаётся после свапа на другого покемона' },
    ],
  },
  {
    version: '0.4.1',
    date: '8 марта 2026',
    type: 'fix',
    title: 'Мега-эволюции и Z-ходы',
    changes: [
      { tag: 'new',  text: 'Мега-эволюция теперь видна обоим игрокам — спрайт меняется через парсинг логов' },
      { tag: 'new',  text: 'Z-атаки: при активации показывается Z-название атаки (Shattered Psyche и т.д.)' },
      { tag: 'fix',  text: 'Z и Мега состояния сохраняются в sessionStorage — не сбрасываются при перезаходе' },
      { tag: 'fix',  text: 'Дублирование строк в логах боя устранено' },
      { tag: 'new',  text: 'В тултипе противника видны его использованные атаки с количеством применений' },
    ],
  },
  {
    version: '0.4.0',
    date: '5 марта 2026',
    type: 'update',
    title: 'Боевой экран — большое обновление',
    changes: [
      { tag: 'new',  text: 'Кнопки Мега-эволюции и Z-хода с анимацией пульсации' },
      { tag: 'new',  text: 'Тултипы покемонов на арене — базовые статы, HP, статусы, летучие эффекты' },
      { tag: 'new',  text: 'Тултипы иконок команды с полной информацией о покемоне' },
      { tag: 'new',  text: 'Бейдж типа атаки на кнопках ходов' },
      { tag: 'fix',  text: 'Struggle корректно отображается когда все PP на нуле' },
    ],
  },
  {
    version: '0.3.5',
    date: '1 марта 2026',
    type: 'fix',
    title: 'Исправления тимбилдера',
    changes: [
      { tag: 'fix',  text: 'Импорт Showdown Paste — исправлен парсинг покемонов с полом (F)/(M) в имени' },
      { tag: 'fix',  text: 'После импорта команды базовые статы теперь корректно подгружаются из покедекса' },
      { tag: 'fix',  text: 'Пол покемона больше не попадает в поле "Имя"' },
    ],
  },
  {
    version: '0.3.0',
    date: '24 февраля 2026',
    type: 'update',
    title: 'Хазарды и погода',
    changes: [
      { tag: 'new',  text: 'Отображение хазардов поля — Stealth Rock, Spikes, Toxic Spikes, Sticky Web' },
      // { tag: 'new',  text: 'Анимация погоды — Дождь, Солнце, Песчаная буря, Снег, Град' },
      { tag: 'new',  text: 'Бейдж погоды с таймером оставшихся ходов' },
      { tag: 'new',  text: 'Летучие эффекты на покемонах — Замешательство, Посев, Замена и другие' },
    ],
  },
];

// ── TAG CONFIG ────────────────────────────────────────────────
const TAG_CFG = {
  new:  { label: 'НОВОЕ',    bg: '#1a3a2a', color: '#4ade80', border: '#2d6b47' },
  fix:  { label: 'ИСПРАВ',   bg: '#3a1a1a', color: '#f87171', border: '#6b2d2d' },
  tweak:{ label: 'УЛУЧШ',    bg: '#1a2a3a', color: '#60a5fa', border: '#2d4a6b' },
};
const TYPE_CFG = {
  hotfix: { label: '🔥 Хотфикс', color: '#f87171', glow: 'rgba(248,113,113,0.3)' },
  fix:    { label: '🔧 Патч',    color: '#fbbf24', glow: 'rgba(251,191,36,0.3)'  },
  update: { label: '✨ Обновление', color: '#818cf8', glow: 'rgba(129,140,248,0.3)' },
};

export default function NewsPage() {
  const [expanded, setExpanded] = useState({ 0: true });
  const [copied, setCopied] = useState(null);

  const toggle = (i) => setExpanded(p => ({ ...p, [i]: !p[i] }));

  const copy = (val, id) => {
    navigator.clipboard.writeText(val);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div style={s.page}>
      <style>{CSS}</style>

      {/* ── ШАПКА ── */}
      <header style={s.header}>
        <div style={s.headerInner}>
          <div style={s.logo}>
            <span style={s.logoPoke}>⚔</span>
            <div>
              <div style={s.logoTitle}>PokéBattle</div>
              <div style={s.logoSub}>Патчноуты и обновления</div>
            </div>
          </div>
          <div style={s.headerBadge}>v{PATCHES[0].version}</div>
        </div>
        <div style={s.headerGlow}/>
      </header>

      <div style={s.layout}>

        {/* ── ПАТЧНОУТЫ ── */}
        <main style={s.main}>
          <div style={s.sectionTitle}>
            <span style={s.sectionIcon}>📋</span> История обновлений
          </div>

          {PATCHES.map((patch, i) => {
            const tc = TYPE_CFG[patch.type] || TYPE_CFG.update;
            const isOpen = !!expanded[i];
            return (
              <div key={i} style={s.card} className="patch-card">
                {/* Полоска типа слева */}
                <div style={{ ...s.cardAccent, background: tc.color, boxShadow: `0 0 12px ${tc.glow}` }}/>

                <div style={s.cardHeader} onClick={() => toggle(i)} className="patch-header">
                  <div style={s.cardMeta}>
                    <span style={{ ...s.versionBadge, borderColor: tc.color, color: tc.color }}>
                      v{patch.version}
                    </span>
                    <span style={{ ...s.typeBadge, color: tc.color }}>{tc.label}</span>
                    <span style={s.dateBadge}>{patch.date}</span>
                  </div>
                  <div style={s.cardTitleRow}>
                    <h2 style={s.cardTitle}>{patch.title}</h2>
                    <span style={{ ...s.arrow, transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                  </div>
                  <div style={s.changeCount}>
                    {patch.changes.length} изменени{patch.changes.length === 1 ? 'е' : 'я'}
                  </div>
                </div>

                {isOpen && (
                  <ul style={s.changeList} className="change-list">
                    {patch.changes.map((c, j) => {
                      const tg = TAG_CFG[c.tag] || TAG_CFG.tweak;
                      return (
                        <li key={j} style={s.changeItem} className="change-item">
                          <span style={{ ...s.tag, background: tg.bg, color: tg.color, border: `1px solid ${tg.border}` }}>
                            {tg.label}
                          </span>
                          <span style={s.changeText}>{c.text}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </main>

        {/* ── САЙДБАР ── */}
        <aside style={s.sidebar}>

          {/* Контакты */}
          <div style={s.sideCard}>
            <div style={s.sideTitle}>
              <span>📡</span> Контакты
            </div>
            <div style={s.contactList}>
              {CONTACTS.map((c, i) => (
                <div key={i} style={s.contactRow} className="contact-row">
                  <div style={s.contactLeft}>
                    <span style={s.contactIcon}>{c.icon}</span>
                    <div>
                      <div style={s.contactLabel}>{c.label}</div>
                      <div style={s.contactValue}>{c.value}</div>
                    </div>
                  </div>
                  <div style={s.contactActions}>
                    <a href={c.href} target="_blank" rel="noreferrer" style={s.contactBtn} className="contact-btn" title="Открыть">↗</a>
                    <button onClick={() => copy(c.value, i)} style={s.contactBtn} className="contact-btn" title="Копировать">
                      {copied === i ? '✓' : '⎘'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Статистика */}
          <div style={s.sideCard}>
            <div style={s.sideTitle}><span>📊</span> Статистика</div>
            <div style={s.statGrid}>
              {[
                { label: 'Версий',     val: PATCHES.length },
                { label: 'Исправлений', val: PATCHES.flatMap(p=>p.changes).filter(c=>c.tag==='fix').length },
                { label: 'Фичей',      val: PATCHES.flatMap(p=>p.changes).filter(c=>c.tag==='new').length },
                { label: 'Патчей',     val: PATCHES.filter(p=>p.type==='hotfix').length },
              ].map((st, i) => (
                <div key={i} style={s.statItem}>
                  <div style={s.statVal}>{st.val}</div>
                  <div style={s.statLbl}>{st.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Баги */}
          <div style={s.sideCard}>
            <div style={s.sideTitle}><span>🐛</span> Сообщить о баге</div>
            <p style={s.bugText}>
              Нашёл баг? Напиши в Discord или открой Issue на GitHub — укажи что произошло и как воспроизвести.
            </p>
            <a href={CONTACTS.find(c=>c.label==='GitHub')?.href || '#'} target="_blank" rel="noreferrer" style={s.bugBtn} className="bug-btn">
              Открыть Issue →
            </a>
          </div>

        </aside>
      </div>
    </div>
  );
}

// ── STYLES ────────────────────────────────────────────────────
const s = {
  page: {
    minHeight: '100vh',
    background: '#0d1117',
    color: '#c9d1d9',
    fontFamily: "'Segoe UI', system-ui, sans-serif",
  },
  header: {
    position: 'relative',
    background: 'linear-gradient(135deg, #161b22 0%, #1a1f2e 50%, #161b22 100%)',
    borderBottom: '1px solid #21262d',
    overflow: 'hidden',
    padding: '0 0 0 0',
  },
  headerInner: {
    maxWidth: 1100,
    margin: '0 auto',
    padding: '24px 32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
    zIndex: 1,
  },
  logo: { display: 'flex', alignItems: 'center', gap: 16 },
  logoPoke: { fontSize: 36, filter: 'drop-shadow(0 0 12px #818cf8)' },
  logoTitle: { fontSize: 24, fontWeight: 800, color: '#f0f6fc', letterSpacing: '-0.5px' },
  logoSub: { fontSize: 13, color: '#8b949e', marginTop: 2 },
  headerBadge: {
    background: 'linear-gradient(135deg, #1f2d4a, #2d3748)',
    border: '1px solid #30363d',
    borderRadius: 8,
    padding: '6px 14px',
    fontSize: 13,
    color: '#818cf8',
    fontWeight: 700,
    fontFamily: 'monospace',
  },
  headerGlow: {
    position: 'absolute', bottom: 0, left: '50%',
    transform: 'translateX(-50%)',
    width: '60%', height: 1,
    background: 'linear-gradient(90deg, transparent, #818cf8, transparent)',
  },
  layout: {
    maxWidth: 1100, margin: '0 auto',
    padding: '32px 32px',
    display: 'grid',
    gridTemplateColumns: '1fr 280px',
    gap: 24,
    alignItems: 'start',
  },
  main: { display: 'flex', flexDirection: 'column', gap: 12 },
  sectionTitle: {
    display: 'flex', alignItems: 'center', gap: 8,
    fontSize: 13, fontWeight: 600, color: '#8b949e',
    textTransform: 'uppercase', letterSpacing: '1px',
    marginBottom: 4,
  },
  sectionIcon: { fontSize: 16 },

  // Карточка патча
  card: {
    background: '#161b22',
    border: '1px solid #21262d',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    transition: 'border-color .2s',
  },
  cardAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 3 },
  cardHeader: {
    padding: '16px 20px 16px 24px',
    cursor: 'pointer',
    userSelect: 'none',
  },
  cardMeta: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  versionBadge: {
    fontSize: 11, fontWeight: 700, fontFamily: 'monospace',
    border: '1px solid', borderRadius: 6,
    padding: '2px 8px', letterSpacing: '.5px',
  },
  typeBadge: { fontSize: 12, fontWeight: 600 },
  dateBadge: { fontSize: 11, color: '#8b949e', marginLeft: 'auto' },
  cardTitleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontSize: 16, fontWeight: 700, color: '#f0f6fc', margin: 0 },
  arrow: { color: '#8b949e', fontSize: 10, transition: 'transform .25s', flexShrink: 0 },
  changeCount: { fontSize: 11, color: '#8b949e', marginTop: 4 },

  changeList: {
    margin: 0, padding: '0 20px 16px 24px',
    display: 'flex', flexDirection: 'column', gap: 6,
    listStyle: 'none',
    borderTop: '1px solid #21262d',
    paddingTop: 12,
  },
  changeItem: { display: 'flex', alignItems: 'flex-start', gap: 8 },
  tag: {
    fontSize: 9, fontWeight: 800, letterSpacing: '.8px',
    padding: '2px 6px', borderRadius: 4, flexShrink: 0,
    marginTop: 2, textTransform: 'uppercase',
  },
  changeText: { fontSize: 13, color: '#c9d1d9', lineHeight: 1.5 },

  // Сайдбар
  sidebar: { display: 'flex', flexDirection: 'column', gap: 16 },
  sideCard: {
    background: '#161b22',
    border: '1px solid #21262d',
    borderRadius: 12,
    padding: '16px',
  },
  sideTitle: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 12, fontWeight: 700, color: '#8b949e',
    textTransform: 'uppercase', letterSpacing: '1px',
    marginBottom: 14,
  },
  contactList: { display: 'flex', flexDirection: 'column', gap: 8 },
  contactRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '8px 10px',
    background: '#0d1117',
    borderRadius: 8,
    border: '1px solid #21262d',
  },
  contactLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  contactIcon: { fontSize: 18 },
  contactLabel: { fontSize: 11, color: '#8b949e', fontWeight: 600 },
  contactValue: { fontSize: 12, color: '#c9d1d9', marginTop: 1 },
  contactActions: { display: 'flex', gap: 4 },
  contactBtn: {
    background: '#21262d', border: '1px solid #30363d',
    borderRadius: 6, padding: '4px 8px',
    color: '#8b949e', fontSize: 13, cursor: 'pointer',
    textDecoration: 'none', lineHeight: 1,
    transition: 'all .15s',
  },
  statGrid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8,
  },
  statItem: {
    background: '#0d1117', borderRadius: 8, padding: '10px 12px',
    border: '1px solid #21262d', textAlign: 'center',
  },
  statVal: { fontSize: 22, fontWeight: 800, color: '#f0f6fc', fontFamily: 'monospace' },
  statLbl: { fontSize: 10, color: '#8b949e', marginTop: 2, textTransform: 'uppercase', letterSpacing: '.5px' },
  bugText: { fontSize: 12, color: '#8b949e', lineHeight: 1.6, margin: '0 0 12px' },
  bugBtn: {
    display: 'block', textAlign: 'center',
    background: 'linear-gradient(135deg, #1f2d1a, #2d3a1f)',
    border: '1px solid #3a5a2a', borderRadius: 8,
    padding: '8px 16px', color: '#4ade80',
    fontSize: 13, fontWeight: 600, textDecoration: 'none',
    transition: 'all .2s',
  },
};

const CSS = `
  .patch-card:hover { border-color: #30363d !important; }
  .patch-header:hover .patch-title { color: #fff; }
  .change-item:hover { background: rgba(255,255,255,.02); border-radius: 6px; }
  .contact-row:hover { border-color: #30363d !important; }
  .contact-btn:hover { background: #30363d !important; color: #c9d1d9 !important; }
  .bug-btn:hover { background: linear-gradient(135deg, #2d4a22, #3a5a2a) !important; border-color: #4ade80 !important; }
  .change-list { animation: slideDown .2s ease; }
  @keyframes slideDown { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }
  * { box-sizing: border-box; }
  @media (max-width: 768px) {
    div[style*="grid-template-columns"] { grid-template-columns: 1fr !important; }
    div[style*="padding: 32px"] { padding: 16px !important; }
  }
`;
