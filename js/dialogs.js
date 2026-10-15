// Keep keyboard focus in the top visible dialog and return it on close.
(function() {
  let active=null, previous=null;
  const visible=el=>el.getClientRects().length>0 && getComputedStyle(el).visibility!=='hidden';
  const controls=el=>[...el.querySelectorAll('button,input,select,textarea,a[href],[tabindex="0"]')].filter(e=>!e.disabled && visible(e));
  function sync() {
    const dialogs=[...document.querySelectorAll('.gov-modal,[role="dialog"],[role="alertdialog"]')];
    const next=dialogs.filter(visible).at(-1);
    if(next===active) return;
    if(!next) {
      active=null;
      if(previous?.isConnected) previous.focus();
      previous=null;return;
    }
    if(!active) previous=document.activeElement;
    active=next;
    if(!active.hasAttribute('role')) active.setAttribute('role','dialog');
    active.setAttribute('aria-modal','true');
    if(!active.contains(document.activeElement)) {
      active.tabIndex=-1;
      (controls(active)[0] || active).focus();
    }
  }
  document.addEventListener('keydown',event=>{
    if(!active || active.id==='appConfirmOverlay') return;
    if(event.key==='Escape') {active.style.display='none';event.preventDefault();return;}
    if(event.key!=='Tab') return;
    const items=controls(active), first=items[0], last=items.at(-1);
    if(!first) {event.preventDefault();active.focus();}
    else if(event.shiftKey && document.activeElement===first) {event.preventDefault();last.focus();}
    else if(!event.shiftKey && document.activeElement===last) {event.preventDefault();first.focus();}
  });
  new MutationObserver(sync).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['style','class']});
  sync();
})();
