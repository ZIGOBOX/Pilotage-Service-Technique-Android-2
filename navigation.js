(function(){
  'use strict';
  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>Array.from(r.querySelectorAll(s));
  function closeMenu(){
    document.body.classList.remove('menu-open');
    const open=q('#openMenu'); if(open) open.setAttribute('aria-expanded','false');
  }
  function openMenu(){
    document.body.classList.add('menu-open');
    const open=q('#openMenu'); if(open) open.setAttribute('aria-expanded','true');
  }
  function switchView(id){
    if(typeof window.PSTSetView==='function'){
      window.PSTSetView(id);
      return true;
    }
    const target=document.getElementById(id);
    if(!target) return false;
    qa('.view').forEach(v=>v.classList.toggle('active',v===target));
    qa('.nav-btn[data-view]').forEach(b=>{
      const active=b.dataset.view===id;
      b.classList.toggle('active',active);
      b.setAttribute('aria-current',active?'page':'false');
    });
    const title=q('#pageTitle');
    const activeBtn=q('.nav-btn[data-view="'+CSS.escape(id)+'"]');
    if(title && activeBtn) title.textContent=activeBtn.textContent.trim();
    closeMenu();
    window.scrollTo(0,0);
    document.dispatchEvent(new CustomEvent('pst:view-changed',{detail:{view:id}}));
    return true;
  }
  function initNavigation(){
    const open=q('#openMenu'), close=q('#closeMenu'), backdrop=q('#menuBackdrop'), nav=q('#nav');
    if(open){
      open.type='button';
      open.style.touchAction='manipulation';
      open.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();openMenu();},{passive:false});
    }
    if(close){
      close.type='button';
      close.style.touchAction='manipulation';
      close.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();closeMenu();},{passive:false});
    }
    if(backdrop) backdrop.addEventListener('click',closeMenu);
    if(nav){
      nav.addEventListener('click',e=>{
        const btn=e.target.closest('.nav-btn[data-view]');
        if(!btn) return;
        e.preventDefault(); e.stopPropagation();
        switchView(btn.dataset.view);
      });
      qa('.nav-btn[data-view]',nav).forEach(btn=>{btn.type='button';btn.tabIndex=0;});
    }
    document.addEventListener('keydown',e=>{if(e.key==='Escape') closeMenu();});
    window.addEventListener('resize',()=>{if(window.innerWidth>900) closeMenu();});
    document.addEventListener('click',e=>{
      const go=e.target.closest('[data-go]');
      if(go && go.dataset.go){e.preventDefault();switchView(go.dataset.go);}
    },true);
    const alreadyActive=q('.view.active');
    if(!alreadyActive) switchView('dashboard');
    document.documentElement.classList.add('navigation-ready');
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initNavigation,{once:true});
  else initNavigation();
  window.PSTNavigation={openMenu,closeMenu,switchView};
})();
