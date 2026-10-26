    if(error){toast(friendlyError(error),'error');return;}
    const paths=(item?.image_urls||[]).map(storagePathFromUrl).filter(path=>path&&path.startsWith(`${user.id}/`));
    if(paths.length){const removed=await db.storage.from('listing-images').remove(paths);if(removed.error)console.warn('Silinen ilan fotoğrafları depodan kaldırılamadı:',removed.error.message);}
    toast('İlan silindi.','success'); await refreshData(); go('my-listings');
  }
  async function resetPasswordFromProfile() {
    if(!user?.email) return;
    const {error}=await db.auth.resetPasswordForEmail(user.email,{redirectTo:location.origin+location.pathname});
    if(error) toast(friendlyError(error),'error'); else toast('Şifre sıfırlama bağlantısı e-postana gönderildi.','success');
  }
  async function logout() {
    if(!configured || !user) {go('home');return;}
    const {error}=await db.auth.signOut();
    if(error){toast(friendlyError(error),'error');return;}
    user=null; favoriteIds=getDemoFavorites(); toast('Güvenli çıkış yapıldı.','success'); await afterAuthChange(); go('home');
  }

  // Delegated UI events: the app re-renders pages without losing interactions.
  document.addEventListener('click', async event => {
    const routeButton = event.target.closest('[data-route]');
    if(routeButton) { event.preventDefault(); const next=routeButton.dataset.route; if(next==='create' && !user && configured){showAuth('login',{text:'İlan vermek için giriş yap veya ücretsiz kayıt ol.',type:'warning'});return;} if(next==='create' && !configured){showAuth('login');return;} if(next==='account' && !user){showAuth('login');} go(next); return; }
    const actionButton = event.target.closest('[data-action]');
    if(!actionButton) return;
    const action=actionButton.dataset.action;
    if(action==='toggle-favorite') await toggleFavorite(actionButton.dataset.id);
    else if(action==='detail') showListingDetail(actionButton.dataset.id);
    else if(action==='contact') await contactSeller(actionButton.dataset.id);
    else if(action==='category') {searchState.category=actionButton.dataset.category; searchState.query='';searchState.city='';searchState.min='';searchState.max='';visibleLimit=20;go('listings');}
    else if(action==='reset-filters') {searchState={query:'',category:'',city:'',min:'',max:''};sortMode='newest';visibleLimit=20;renderListingsPage();}
    else if(action==='load-more') {visibleLimit+=20;renderListingsPage();}
    else if(action==='edit-listing') go('create',{editId:actionButton.dataset.id});
    else if(action==='toggle-listing-status') await setListingStatus(actionButton.dataset.id,actionButton.dataset.status);
    else if(action==='delete-listing') await deleteListing(actionButton.dataset.id);
    else if(action==='remove-existing-image') { editorExistingImages.splice(Number(actionButton.dataset.index),1); $('#photoPreview').innerHTML=renderImagePreviews(); }
    else if(action==='remove-new-image') { editorFiles.splice(Number(actionButton.dataset.index),1); $('#photoPreview').innerHTML=renderImagePreviews(); }
    else if(action==='open-thread') await openThread(actionButton.dataset.listingId,actionButton.dataset.otherId,actionButton.dataset.title);
    else if(action==='auth-mode') { authNotice=''; showAuth(actionButton.dataset.mode); }
    else if(action==='logout') await logout();
    else if(action==='password-reset') await resetPasswordFromProfile();
  });
  document.addEventListener('submit', async event => {
    const form=event.target;
    if(!form.matches('form')) return;
    if(form.id==='heroSearchForm') {
      event.preventDefault(); const fd=new FormData(form); searchState={...searchState,query:String(fd.get('query')||'').trim(),category:String(fd.get('category')||''),city:String(fd.get('city')||'')}; visibleLimit=20; go('listings');
    } else if(form.id==='filtersForm') {
      event.preventDefault(); const fd=new FormData(form); searchState={query:String(fd.get('query')||'').trim(),category:String(fd.get('category')||''),city:String(fd.get('city')||''),min:String(fd.get('min')||''),max:String(fd.get('max')||'')}; sortMode=String(fd.get('sort')||'newest'); visibleLimit=20; renderListingsPage();
    } else if(form.id==='listingForm') {event.preventDefault();await handleListingSubmit(form);}
    else if(form.id==='profileForm') {event.preventDefault();await handleProfileSubmit(form);}
    else if(form.id==='authForm') {event.preventDefault();await handleAuthSubmit(form);}
    else if(form.id==='threadForm') {event.preventDefault();await handleThreadSubmit(form);}
  });
  document.addEventListener('change', event => {
    if(event.target.id==='listingPhotos') {
      const incoming=[...(event.target.files||[])];
      for(const file of incoming){
        if(!['image/jpeg','image/png','image/webp'].includes(file.type)){toast('Yalnızca JPG, PNG veya WEBP fotoğraf kabul edilir.','error');return;}
        if(file.size>5*1024*1024){toast('Her fotoğraf en fazla 5 MB olabilir.','error');return;}
      }
      if(editorExistingImages.length+editorFiles.length+incoming.length>5){toast('Toplam en fazla 5 fotoğraf ekleyebilirsin.','error');return;}
      editorFiles.push(...incoming); const preview=$('#photoPreview');if(preview)preview.innerHTML=renderImagePreviews(); event.target.value='';
    }
  });
  $('#mobileMenu').addEventListener('click',()=>{const nav=$('#mainNav');nav.classList.toggle('open');$('#mobileMenu').setAttribute('aria-expanded',nav.classList.contains('open')?'true':'false');});
  $('#dialogClose').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
  dialog.addEventListener('close',()=>{dialogContent.innerHTML='';});
  window.addEventListener('popstate',()=>{const next=(location.hash||'#home').slice(1);route=['home','listings','favorites','my-listings','messages','create','account','privacy','terms'].includes(next)?next:'home';routeParams={};renderRoute();});
  window.addEventListener('hashchange',()=>{const next=(location.hash||'#home').slice(1);if(next!==route&&['home','listings','favorites','my-listings','messages','create','account','privacy','terms'].includes(next)){route=next;routeParams={};renderRoute();}});
  $('#footerYear').textContent=String(new Date().getFullYear());

  async function boot() {
    if(!configured) {
      setBanner('TANITIM ÖNİZLEMESİ: Veritabanı bağlantısı henüz kurulmadı. Görünen örnek ilanlar gerçek ilan değildir. Gerçek üyelik, fotoğraf yükleme ve kalıcı kayıt için README.md adımlarını uygula.');
      listings=DEMO_LISTINGS.slice();favoriteIds=getDemoFavorites();
      const initial=(location.hash||'#home').slice(1);route=['home','listings','favorites','my-listings','messages','create','account','privacy','terms'].includes(initial)?initial:'home';
      renderRoute();
      return;
    }
    setBanner('Bağlantı kuruluyor…');
    try {
      const {data:{session},error}=await db.auth.getSession();
      if(error) throw error;
      user=session?.user||null;
      setBanner('');
      await afterAuthChange();
      const initial=(location.hash||'#home').slice(1);route=['home','listings','favorites','my-listings','messages','create','account','privacy','terms'].includes(initial)?initial:'home';
      renderRoute();
      db.auth.onAuthStateChange((event,session) => {
        user=session?.user||null;
        if(event==='PASSWORD_RECOVERY') { window.setTimeout(()=>showAuth('update-password'),0); return; }
        window.setTimeout(async()=>{await afterAuthChange(); if(route==='create'&&!user)go('home');},0);
      });
      const authHashParams = new URLSearchParams((location.hash || '').replace(/^#/,''));
      if (authHashParams.get('type') === 'recovery') window.setTimeout(() => showAuth('update-password'), 0);
    } catch(error) {
      console.error(error);
      setBanner(`BAĞLANTI HATASI: ${friendlyError(error)} config.js ve Supabase ayarlarını kontrol et.`);
      listings=[]; dataError=friendlyError(error);renderRoute();
    }
  }
  boot();
})();
