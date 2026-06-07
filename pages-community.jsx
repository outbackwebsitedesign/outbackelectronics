import React, { useState, useEffect } from 'react';

function renderMarkdown(md) {
  if (!md) return null;
  const lines = md.split('\n');
  const nodes = [];
  let i = 0;

  const inlineRender = (text) => {
    const parts = [];
    const pattern = /(`[^`]+`|\*\*[^*]+\*\*|_[^_]+_|\[([^\]]+)\]\(([^)]+)\)|!\[([^\]]*)\]\(([^)]+)\))/g;
    let last = 0, m;
    while ((m = pattern.exec(text)) !== null) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      const t = m[0];
      if (t.startsWith('![')) {
        parts.push(<img key={m.index} src={m[5]} alt={m[4]} style={{maxWidth:'100%', margin:'8px 0', display:'block'}} />);
      } else if (t.startsWith('[')) {
        parts.push(<a key={m.index} href={m[3]} style={{color:'var(--rust)'}} target="_blank" rel="noopener noreferrer">{m[2]}</a>);
      } else if (t.startsWith('**')) {
        parts.push(<strong key={m.index}>{t.slice(2,-2)}</strong>);
      } else if (t.startsWith('_')) {
        parts.push(<em key={m.index}>{t.slice(1,-1)}</em>);
      } else {
        parts.push(<code key={m.index} style={{background:'var(--bg-elev)', padding:'1px 5px', fontFamily:'monospace', fontSize:'0.9em'}}>{t.slice(1,-1)}</code>);
      }
      last = m.index + t.length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts;
  };

  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) { codeLines.push(lines[i]); i++; }
      nodes.push(<pre key={i} style={{background:'var(--bg-elev)', padding:'14px 18px', overflowX:'auto', fontSize:13, lineHeight:1.55, margin:'16px 0'}}><code>{codeLines.join('\n')}</code></pre>);
    } else if (line.startsWith('## ')) {
      nodes.push(<h2 key={i} style={{fontFamily:'Instrument Serif, serif', fontSize:26, marginTop:28, marginBottom:6, lineHeight:1.15}}>{line.slice(3)}</h2>);
    } else if (line.startsWith('### ')) {
      nodes.push(<h3 key={i} style={{fontFamily:'Instrument Serif, serif', fontSize:21, marginTop:22, marginBottom:4, lineHeight:1.2}}>{line.slice(4)}</h3>);
    } else if (/^[-*] /.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) { items.push(<li key={i}>{inlineRender(lines[i].slice(2))}</li>); i++; }
      nodes.push(<ul key={`ul-${i}`} style={{paddingLeft:22, margin:'8px 0 14px'}}>{items}</ul>);
      continue;
    } else if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) { items.push(<li key={i}>{inlineRender(lines[i].replace(/^\d+\. /, ''))}</li>); i++; }
      nodes.push(<ol key={`ol-${i}`} style={{paddingLeft:22, margin:'8px 0 14px'}}>{items}</ol>);
      continue;
    } else if (line.trim() === '') {
      nodes.push(<div key={i} style={{height:10}} />);
    } else {
      nodes.push(<p key={i} style={{margin:'0 0 10px', lineHeight:1.75}}>{inlineRender(line)}</p>);
    }
    i++;
  }
  return nodes;
}

function TutorialModal({ tutorial, onClose }) {
  const body = tutorial.body;
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div style={{position:'fixed', inset:0, zIndex:500, background:'rgba(15,13,10,0.75)', display:'flex', flexDirection:'column', alignItems:'center', padding:'48px 16px', overflowY:'auto'}}
      aria-modal="true" role="dialog" aria-label={tutorial.title || 'Tutorial'}
      onClick={onClose}>
      <div style={{width:'100%', maxWidth:720, background:'var(--paper)', padding:'40px 48px', boxShadow:'0 16px 48px rgba(0,0,0,.3)'}}
        onClick={e => e.stopPropagation()}>
        <div className="row-flex" style={{justifyContent:'space-between', marginBottom:8}}>
          <span className="tag tag-outline">{tutorial.cat?.toUpperCase() || 'TUTORIAL'}</span>
          <button style={{background:'none', border:'none', cursor:'pointer', fontSize:22, color:'var(--ink-2)', lineHeight:1}} onClick={onClose}>×</button>
        </div>
        <h1 style={{fontFamily:'Instrument Serif, serif', fontSize:40, lineHeight:1.05, marginTop:10}}>{tutorial.title || tutorial.t}</h1>
        <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginTop:10, marginBottom:28}}>
          {tutorial.author?.toUpperCase()} · {tutorial.date?.toUpperCase()}{tutorial.dur ? ` · ${tutorial.dur}` : ''}{tutorial.diff ? ` · ${tutorial.diff.toUpperCase()}` : ''}
        </div>
        <div style={{fontSize:15, color:'var(--ink)', marginBottom:28}}>
          {body ? renderMarkdown(body) : <p style={{color:'var(--ink-2)'}}>No content available for this tutorial yet.</p>}
        </div>
        <div className="row-flex" style={{gap:8}}>
          <button className="btn btn-rust" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TUTORIALS
// ============================================================
function TutorialsPage({ go }) {
  const [filter, setFilter] = useState('All');
  const [activeTutorial, setActiveTutorial] = useState(null);
  const [tutorials, setTutorials] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!activeTutorial) return;
    const h = e => { if (e.key === 'Escape') setActiveTutorial(null); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [activeTutorial]);
  useEffect(() => {
    fetch('/api/tutorials').then(r => r.ok ? r.json() : Promise.reject()).then(d => {
      const all = d.items || [];
      setTutorials(all.filter(t => t.status === 'published'));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  // Build category list from data, plus 'All'
  const cats = ['All', ...Array.from(new Set(tutorials.map(t => t.category).filter(Boolean)))];

  const list = filter === 'All' ? tutorials : tutorials.filter(t => t.category === filter);

  return (
    <>
      <PageHead crumbs={['Outback','Tutorials']} title="Tutorials &amp; Guides"
        lead="Step-by-step guides, video walkthroughs, and bench notes from the workshop." />
      <section className="container" style={{paddingTop: 32, paddingBottom: 48}}>

        {/* Category filters */}
        <div className="tabs" style={{marginBottom: 24}}>
          {cats.map(c => (
            <div key={c} className={`tab ${filter===c?'active':''}`} onClick={() => setFilter(c)}>{c}</div>
          ))}
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:20}}>
            {Array.from({length:6}).map((_,i) => (
              <div key={i} style={{height:200, background:'var(--bg-elev)', animation:'pulse 1.4s ease-in-out infinite', opacity:0.5}} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && list.length === 0 && (
          <div style={{padding:'48px 0'}}>
            <p className="serif" style={{fontSize:28, marginBottom:12}}>Writing up the first ones now.</p>
            <p style={{color:'var(--ink-2)', fontSize:15, maxWidth:520, lineHeight:1.7}}>
              We have plenty of hard-won knowledge from years of field repairs — we're just getting it out of our heads and onto the page. Check back soon.
            </p>
          </div>
        )}

        {/* Tutorial grid */}
        {!loading && list.length > 0 && (
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:20}}>
            {list.map((t, i) => (
              <div key={t.id||i} className="card-paper" style={{display:'flex', flexDirection:'column', overflow:'hidden', opacity: t.locked ? 0.8 : 1}}>
                <div style={{padding:'20px 24px 0'}}>
                  {t.locked && <span className="tag tag-rust" style={{marginBottom:8, display:'inline-block'}}>MEMBERS ONLY</span>}
                  {!t.locked && t.category && <span className="tag tag-outline" style={{marginBottom:10, display:'inline-block'}}>{t.category.toUpperCase()}</span>}
                  <h3 className="serif" style={{fontSize:22, lineHeight:1.15, marginTop:6}}>{t.title}</h3>
                  <p style={{marginTop:8, fontSize:13, color:'var(--ink-2)', lineHeight:1.6,
                    overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical'}}>
                    {t.description}
                  </p>
                </div>
                <div style={{padding:'16px 24px 20px', marginTop:'auto'}}>
                  {t.locked
                    ? <a href="/memberships" className="btn btn-ghost btn-sm" style={{textDecoration:'none'}}>Join to unlock →</a>
                    : <button className="btn btn-ghost btn-sm" onClick={() => setActiveTutorial(t)}>Read More →</button>
                  }
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Expanded tutorial modal */}
      {activeTutorial && (
        <div role="dialog" aria-modal="true" aria-label={activeTutorial.title} style={{position:'fixed', inset:0, zIndex:500, background:'rgba(15,13,10,0.75)', display:'flex', flexDirection:'column', alignItems:'center', padding:'48px 16px', overflowY:'auto'}}
          onClick={() => setActiveTutorial(null)}>
          <div style={{width:'100%', maxWidth:760, background:'var(--paper)', padding:'40px 48px', boxShadow:'0 16px 48px rgba(0,0,0,.3)'}}
            onClick={e => e.stopPropagation()}>
            <div className="row-flex" style={{justifyContent:'space-between', marginBottom:8}}>
              {activeTutorial.category && <span className="tag tag-outline">{activeTutorial.category.toUpperCase()}</span>}
              <button style={{background:'none', border:'none', cursor:'pointer', fontSize:22, color:'var(--ink-2)', lineHeight:1, marginLeft:'auto'}} onClick={() => setActiveTutorial(null)}>×</button>
            </div>
            <h1 style={{fontFamily:'Instrument Serif, serif', fontSize:36, lineHeight:1.05, marginTop:10}}>{activeTutorial.title}</h1>
            {activeTutorial.description && (
              <p style={{marginTop:10, fontSize:15, color:'var(--ink-2)', lineHeight:1.7, marginBottom:24}}>{activeTutorial.description}</p>
            )}
            {activeTutorial.videoUrl && (
              <div style={{position:'relative', paddingTop:'56.25%', marginBottom:28, background:'#000'}}>
                <iframe
                  src={activeTutorial.videoUrl}
                  style={{position:'absolute', inset:0, width:'100%', height:'100%', border:0}}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  title={activeTutorial.title}
                />
              </div>
            )}
            {activeTutorial.content ? (
              <div style={{fontSize:15, color:'var(--ink)', lineHeight:1.75}}
                dangerouslySetInnerHTML={{__html: activeTutorial.content}} />
            ) : (
              <p style={{color:'var(--ink-2)', fontSize:14}}>No content available for this tutorial yet.</p>
            )}
            <div style={{marginTop:28}}>
              <button className="btn btn-rust" onClick={() => setActiveTutorial(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// GROUPS
// ============================================================
function GroupsPage({ go }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/groups').then(r => r.ok ? r.json() : Promise.reject()).then(d => {
      const all = d.groups || d.items || [];
      setGroups(all.filter(g => g.status === 'active'));
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHead crumbs={['Outback','Groups']} title="Community Groups"
        lead="Online groups for electronics enthusiasts. Topic clubs, tinkerers, and fixers — connect and chat from wherever you are."
        kicker={<button className="btn btn-rust" onClick={() => go('contact')}>+ Start a group</button>} />

      <section className="container" style={{paddingTop: 32, paddingBottom: 40}}>
        {loading && (
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:20}}>
            {Array.from({length:4}).map((_,i) => (
              <div key={i} style={{height:180, background:'var(--bg-elev)', animation:'pulse 1.4s ease-in-out infinite', opacity: 0.5 + (i % 2) * 0.2}} />
            ))}
          </div>
        )}
        {!loading && groups.length === 0 && (
          <div style={{padding:'48px 0'}}>
            <p className="serif" style={{fontSize:28, marginBottom:12}}>No groups yet.</p>
            <p style={{color:'var(--ink-2)', fontSize:15, maxWidth:520, lineHeight:1.7}}>
              Be the first to start one. Hit the button above and we'll get it set up.
            </p>
          </div>
        )}
        {!loading && groups.length > 0 && (
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:20}}>
            {groups.map((g,i) => (
              <div key={g.id||i} className="card-paper" style={{padding:24, display:'flex', flexDirection:'column', gap:12, opacity: g.locked ? 0.8 : 1}}>
                <div>
                  {g.locked && <span className="tag tag-rust" style={{marginBottom:8, display:'inline-block'}}>MEMBERS ONLY</span>}
                  <h3 className="serif" style={{fontSize:24, lineHeight:1.1, marginTop:6}}>{g.name}</h3>
                  <p style={{marginTop:8, fontSize:13, color:'var(--ink-2)', lineHeight:1.6}}>{g.description}</p>
                </div>
                <div style={{borderTop:'1px solid var(--line)', paddingTop:12, display:'grid', gap:4}}>
                  {g.organizer && (
                    <div className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>ORGANISER: {g.organizer.toUpperCase()}</div>
                  )}
                  <div className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{g.memberCount || 0} MEMBERS</div>
                  {g.locked && (
                    <a href="/memberships" className="btn btn-ghost btn-sm" style={{textDecoration:'none', marginTop:8, textAlign:'center'}}>Upgrade to join →</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

      </section>
    </>
  );
}

window.OE_PAGES = Object.assign(window.OE_PAGES || {}, {
  tutorials: TutorialsPage,
  groups: GroupsPage,
});
window.dispatchEvent(new Event('oe:pages-updated'));
