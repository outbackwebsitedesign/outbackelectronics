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
  return (
    <div style={{position:'fixed', inset:0, zIndex:500, background:'rgba(15,13,10,0.75)', display:'flex', flexDirection:'column', alignItems:'center', padding:'48px 16px', overflowY:'auto'}}
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
  const [search, setSearch] = useState('');
  const [activeTutorial, setActiveTutorial] = useState(null);
  const [tutorials, setTutorials] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/tutorials').then(r => r.ok ? r.json() : Promise.reject()).then(d => setTutorials(d.items || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);
  const cats = ['All','Repair','Off-grid','Software','AI','Comms'];
  const q = search.trim().toLowerCase();
  const list = tutorials
    .filter(t => filter === 'All' || t.cat === filter)
    .filter(t => !q || (t.title||'').toLowerCase().includes(q) || (t.cat||'').toLowerCase().includes(q));
  return (
    <>
      <PageHead crumbs={['Outback','Tutorials']} title="Tutorials"
        lead="The bench notes we used to scribble on bits of paper. Now in writing, with photos, and occasionally video." />
      <section className="container" style={{paddingTop: 32, paddingBottom: 24}}>
        <div className="tabs" style={{marginBottom: 24}}>
          {cats.map(c => (
            <div key={c} className={`tab ${filter===c?'active':''}`} onClick={() => setFilter(c)}>{c}</div>
          ))}
          <div style={{flex:1}}></div>
          <input className="input" placeholder="Search tutorials…" style={{maxWidth:240, padding:'6px 10px', fontSize:13}} value={search} onChange={e => setSearch(e.target.value)} />
        </div>

        {/* Featured — first two published tutorials */}
        {tutorials.length >= 2 && (
          <div className="grid-2" style={{marginBottom: 32, gap:24}}>
            {tutorials.slice(0, 2).map((t,i) => (
              <div key={t.id||i} className="product" style={{cursor:'pointer'}} onClick={() => setActiveTutorial(t)}>
                <div className={`slot ${i===0?'slot-rust':''}`} style={{aspectRatio:'16/9', fontSize:13}}>{(t.cat||'TUTORIAL').toUpperCase()}{t.dur ? ` · ${t.dur.toUpperCase()}` : ''}</div>
                <div className="body" style={{padding: 22}}>
                  <span className={`tag ${i===0?'tag-rust':'tag-ink'}`}>{i===0 ? 'FEATURED' : 'RECENT'}</span>
                  <h3 className="serif" style={{fontSize: 32, marginTop:10, lineHeight:1.1}}>{t.title}</h3>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* List */}
        <div>
          {loading && <div style={{display:'grid', gap:1}}>
            {Array.from({length:5}).map((_,i) => (
              <div key={i} style={{height:72, background:'var(--bg-elev)', animation:'pulse 1.4s ease-in-out infinite', opacity: 0.5 + (i % 3) * 0.15, borderBottom:'1px solid var(--line)'}} />
            ))}
          </div>}
          {!loading && list.length === 0 && <div className="mono" style={{fontSize:13, color:'var(--ink-2)', padding:'18px 0'}}>No tutorials published yet.</div>}
          {list.map((t,i) => (
            <div key={t.id||i} className="tutorial-row" style={{display:'grid', gridTemplateColumns:'80px 1fr 100px 90px 100px 80px', padding:'18px 8px', borderTop: i===0?'1px solid var(--line)':'none', borderBottom:'1px solid var(--line)', alignItems:'center', gap: 14, cursor:'pointer'}} onClick={() => setActiveTutorial(t)} onMouseEnter={e => e.currentTarget.style.background='var(--bg-elev)'} onMouseLeave={e => e.currentTarget.style.background='transparent'}>
              <div className="serif" style={{fontSize:32, color:'var(--rust)'}}>{String(i+1).padStart(2,'0')}</div>
              <div>
                <div style={{fontWeight:600, fontSize:15}}>{t.title}</div>
                <div className="mono" style={{fontSize:11, color:'var(--ink-2)', marginTop:3}}>{(t.author||'').toUpperCase()}{t.date ? ` · ${t.date.toUpperCase()}` : ''}</div>
                <div className="tutorial-row-meta" style={{display:'none'}}>
                  {t.cat && <span className="tag tag-outline" style={{marginTop:6}}>{t.cat}</span>}
                  {t.diff && <span className="mono" style={{fontSize:11, marginLeft:8, color: t.diff==='Expert'?'var(--rust)':t.diff==='Advanced'?'var(--ochre)':'var(--ink-2)'}}>{t.diff.toUpperCase()}</span>}
                  {t.dur && <span className="mono" style={{fontSize:11, marginLeft:8, color:'var(--ink-2)'}}>{t.dur}</span>}
                </div>
              </div>
              <span className="tutorial-row-col tag tag-outline">{t.cat}</span>
              <span className="tutorial-row-col mono" style={{fontSize:11, color: t.diff==='Expert'?'var(--rust)':t.diff==='Advanced'?'var(--ochre)':'var(--ink-2)'}}>{t.diff ? t.diff.toUpperCase() : '—'}</span>
              <span className="tutorial-row-col mono" style={{fontSize:12, color:'var(--ink-2)'}}>{t.dur || '—'}</span>
              <span className="mono" style={{fontSize:12, color:'var(--rust)'}}>READ →</span>
            </div>
          ))}
        </div>
      </section>
      {activeTutorial && <TutorialModal tutorial={activeTutorial} onClose={() => setActiveTutorial(null)} />}
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
    fetch('/api/groups').then(r => r.ok ? r.json() : Promise.reject()).then(d => setGroups(d.items || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);
  const memberCount = (g) => Array.isArray(g.members) ? g.members.length : (g.memberCount || 0);
  return (
    <>
      <PageHead crumbs={['Outback','Groups']} title="Groups"
        lead="Town-specific chapters &amp; topic clubs. Most meet in sheds. Some meet on the radio. All of them welcome a quiet beginner."
        kicker={<button className="btn btn-rust" onClick={() => go('contact')}>+ Start a chapter</button>} />

      <section className="container" style={{paddingTop: 32, paddingBottom: 40}}>
        {loading && (
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:20}}>
            {Array.from({length:4}).map((_,i) => (
              <div key={i} style={{height:140, background:'var(--bg-elev)', borderRadius:4, animation:'pulse 1.4s ease-in-out infinite', opacity: 0.5 + (i % 2) * 0.2}} />
            ))}
          </div>
        )}
        {!loading && groups.length === 0 && <div className="mono" style={{fontSize:13, color:'var(--ink-2)', padding:'18px 0'}}>No groups listed yet.</div>}
        <div className="grid-2" style={{gap: 20}}>
          {groups.map((g,i) => (
            <div key={g.id||i} className="group-card">
              <div style={{width:88, flexShrink:0, display:'grid', placeItems:'center', background:'var(--bg-deep)', border:'1px solid var(--line-strong)', fontFamily:'Instrument Serif, serif', fontSize: 40, fontStyle:'italic', color:'var(--rust)'}}>
                {(g.name||'').split(' ').map(w => w[0]).slice(0,2).join('')}
              </div>
              <div style={{flex:1}}>
                <div className="row-flex" style={{justifyContent:'space-between'}}>
                  <span className={`tag ${g.badge||'tag-outline'}`}>{(g.loc||'').toUpperCase()}</span>
                  {g.host && <span className="tag tag-outline">HOSTED IN-STORE</span>}
                </div>
                <h3 className="serif" style={{fontSize: 26, marginTop: 8, lineHeight:1.1}}>{g.name}</h3>
                <p style={{marginTop: 6, fontSize:13, color:'var(--ink-2)'}}>{g.focus || g.description}</p>
                <div className="row-flex" style={{justifyContent:'space-between', marginTop: 14, borderTop:'1px solid var(--line)', paddingTop: 12}}>
                  <div className="mono" style={{fontSize:11, color:'var(--ink-2)'}}>{memberCount(g)} MEMBERS{g.meets ? ` · ${g.meets.toUpperCase()}` : ''}</div>
                  <a className="mono" style={{fontSize:11, color:'var(--rust)', cursor:'pointer'}} onClick={() => go('contact', { subject: `Join ${g.name}`, group: g.slug || g.name })}>JOIN →</a>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="card-paper" style={{padding: 32, marginTop: 40, display:'grid', gridTemplateColumns:'1fr 280px', gap:32, alignItems:'center'}}>
          <div>
            <span className="eyebrow">STARTING A CHAPTER</span>
            <h3 className="serif" style={{fontSize: 32, marginTop: 8, lineHeight:1.05}}>We'll send a starter kit. Stickers, a soldering iron, and a kettle.</h3>
            <p style={{marginTop: 10, color:'var(--ink-2)', fontSize:14, maxWidth: 540}}>If you've got a town, a shed, and at least three people who want to fix things together, we'll back you. Apply below and we'll be in touch within a week.</p>
            <button className="btn btn-rust" style={{marginTop: 18}} onClick={() => go('contact')}>Apply for a starter kit →</button>
          </div>
          <div className="slot slot-rust" style={{aspectRatio:'1/1'}}>STARTER KIT · CRATE</div>
        </div>
      </section>
    </>
  );
}

window.OE_PAGES = Object.assign(window.OE_PAGES || {}, {
  tutorials: TutorialsPage,
  groups: GroupsPage,
});
