import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, Check, ChevronDown, Heart, House, LayoutGrid, MapPin, Minus,
  PackageCheck, Plus, Search, ShoppingBag, SlidersHorizontal, UserRound, X,
  Bike, ShieldCheck
} from 'lucide-react';
import { isSupabaseConfigured, supabase } from './lib/supabase.js';

const categoryFallback = [
  { name: 'All items', emoji: '🛍️' }, { name: 'Fruits & Veg', emoji: '🥦' },
  { name: 'Dairy', emoji: '🥛' }, { name: 'Staples', emoji: '🌾' },
  { name: 'Snacks', emoji: '🍪' }, { name: 'Beverages', emoji: '🧃' },
  { name: 'Bakery', emoji: '🍞' }, { name: 'Home Care', emoji: '🧼' }
];
const categoryEmoji = Object.fromEntries(categoryFallback.map(c => [c.name, c.emoji]));
const productEmoji = name => {
  const n = name.toLowerCase();
  if (n.includes('milk')) return '🥛'; if (n.includes('banana')) return '🍌';
  if (n.includes('potato')) return '🥔'; if (n.includes('tomato')) return '🍅';
  if (n.includes('atta') || n.includes('flour')) return '🌾'; if (n.includes('rice')) return '🍚';
  if (n.includes('noodle')) return '🍜'; if (n.includes('detergent')) return '🧺';
  if (n.includes('bread')) return '🍞'; if (n.includes('egg')) return '🥚';
  if (n.includes('juice')) return '🧃'; if (n.includes('chip')) return '🥔';
  return '🛍️';
};
const productColor = category => ({
  Dairy:'#e8f3ff','Fruits & Veg':'#fff0d6',Staples:'#f5ead2',Snacks:'#ffebd7',
  Beverages:'#ffe5c2',Bakery:'#f7e6d5','Home Care':'#e8e7ff'
}[category] || '#eeefe6');
const money = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const rupees = paise => Number(paise || 0) / 100;
const errorText = error => error?.message || 'Something went wrong. Please try again.';

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(categoryFallback);
  const [cart, setCart] = useState({});
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All items');
  const [tab, setTab] = useState('Home');
  const [showCheckout, setShowCheckout] = useState(false);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [addressForm, setAddressForm] = useState({label:'Home',recipient_name:'',phone:'',address_line:'',landmark:'',area:'',pincode:''});
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [payment, setPayment] = useState('cod');
  const [orders, setOrders] = useState([]);
  const [saved, setSaved] = useState([]);
  const [authMode, setAuthMode] = useState('signin');
  const [authForm, setAuthForm] = useState({email:'',password:'',full_name:''});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeKind, setNoticeKind] = useState('info');
  const [loading, setLoading] = useState(true);
  const [authPrompt, setAuthPrompt] = useState(false);

  const say = (message, kind='info') => { setNotice(message); setNoticeKind(kind); };
  const loadCatalogue = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    const [catResult, productResult] = await Promise.all([
      supabase.from('categories').select('id,name,slug,emoji,sort_order').eq('is_active', true).order('sort_order'),
      supabase.from('products').select('id,name,slug,description,unit,price_paise,mrp_paise,image_url,stock_quantity,is_featured,category:categories(name,emoji)').eq('is_active', true).order('name')
    ]);
    if (catResult.error) say('Could not load categories: ' + catResult.error.message, 'error');
    else setCategories([{name:'All items',emoji:'🛍️'}, ...(catResult.data || []).map(c => ({...c}))]);
    if (productResult.error) say('Could not load products: ' + productResult.error.message, 'error');
    else setProducts((productResult.data || []).map(p => ({
      ...p, price:rupees(p.price_paise), oldPrice:p.mrp_paise ? rupees(p.mrp_paise) : null,
      categoryName:p.category?.name || 'Other', emoji:p.category?.emoji || productEmoji(p.name),
      color:productColor(p.category?.name), popular:Boolean(p.is_featured)
    })));
    setLoading(false);
  }, []);

  const loadCustomerData = useCallback(async user => {
    if (!supabase || !user) { setProfile(null); setAddresses([]); setOrders([]); return; }
    const [profileResult, addressResult, orderResult] = await Promise.all([
      supabase.from('profiles').select('id,full_name,phone,role').eq('id', user.id).maybeSingle(),
      supabase.from('addresses').select('*').order('is_default', {ascending:false}).order('created_at', {ascending:false}),
      supabase.from('orders').select('id,order_number,status,payment_method,payment_status,total_paise,created_at,order_items(product_name,unit,quantity,line_total_paise)').order('created_at',{ascending:false}).limit(20)
    ]);
    if (profileResult.error) say(profileResult.error.message, 'error'); else setProfile(profileResult.data);
    if (addressResult.error) say(addressResult.error.message, 'error');
    else {
      setAddresses(addressResult.data || []);
      const first = (addressResult.data || []).find(a => a.is_default) || (addressResult.data || [])[0];
      setSelectedAddress(first?.id || '');
      if (first) setAddressForm(v => ({...v, label:first.label,recipient_name:first.recipient_name,phone:first.phone,address_line:first.address_line,landmark:first.landmark || '',area:first.area,pincode:first.pincode || ''}));
    }
    if (orderResult.error) say(orderResult.error.message, 'error'); else setOrders(orderResult.data || []);
  }, []);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let active = true;
    supabase.auth.getSession().then(({data}) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user) loadCustomerData(data.session.user);
    }).catch(e => say(errorText(e),'error'));
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,nextSession) => {
      setSession(nextSession);
      if (nextSession?.user) {
        setTimeout(() => loadCustomerData(nextSession.user), 0);
      } else {
        setProfile(null); setAddresses([]); setOrders([]); setSelectedAddress('');
      }
    });
    loadCatalogue();
    return () => { active = false; subscription.unsubscribe(); };
  }, [loadCatalogue, loadCustomerData]);

  const count = Object.values(cart).reduce((a,b) => a+b, 0);
  const subtotal = products.reduce((sum,p) => sum + p.price * (cart[p.id] || 0), 0);
  const delivery = subtotal === 0 || subtotal >= 199 ? 0 : 25;
  const visibleProducts = useMemo(() => products.filter(p =>
    (category === 'All items' || p.categoryName === category) &&
    (p.name.toLowerCase().includes(query.toLowerCase()) || p.categoryName.toLowerCase().includes(query.toLowerCase()))
  ), [products, category, query]);

  const changeQty = (id, delta) => setCart(current => {
    const product = products.find(p => p.id === id);
    const next = {...current}; const amount = (next[id] || 0) + delta;
    if (amount <= 0) delete next[id];
    else if (product && amount <= Math.min(product.stock_quantity, 50)) next[id] = amount;
    else say('Only ' + (product?.stock_quantity || 0) + ' available right now.', 'error');
    return next;
  });
  const switchTab = name => { setTab(name); if (name === 'Categories') setCategory('All items'); if (name === 'Cart') setShowCheckout(false); if (name === 'Account' && !session) setAuthPrompt(true); };
  const doAuth = async e => {
    e.preventDefault(); if (!supabase) return;
    setBusy(true); setNotice('');
    try {
      if (authMode === 'signup') {
        const {data,error} = await supabase.auth.signUp({email:authForm.email.trim(),password:authForm.password,options:{data:{full_name:authForm.full_name.trim()}}});
        if (error) throw error;
        if (!data.session) say('Account created. Check your email to confirm it, then sign in.', 'success');
        else say('Your account is ready.', 'success');
      } else {
        const {error} = await supabase.auth.signInWithPassword({email:authForm.email.trim(),password:authForm.password});
        if (error) throw error;
        say('You are signed in.', 'success'); setAuthPrompt(false);
      }
    } catch(e) { say(errorText(e),'error'); }
    finally { setBusy(false); }
  };
  const signOut = async () => { if (!supabase) return; setBusy(true); const {error} = await supabase.auth.signOut(); setBusy(false); if (error) say(error.message,'error'); else {setCart({});setTab('Home');say('Signed out.','success');} };
  const saveAddress = async e => {
    e.preventDefault(); if (!session?.user || !supabase) return;
    setBusy(true);
    const payload = {...addressForm,user_id:session.user.id,city:'Nandurbar',state:'Maharashtra',is_default:addresses.length === 0};
    const {data,error} = await supabase.from('addresses').insert(payload).select('*').single();
    setBusy(false);
    if (error) {say(error.message,'error');return;}
    setAddresses(old => [data,...old]);setSelectedAddress(data.id);setShowAddressForm(false);
    say('Delivery address saved.','success');
  };
  const placeOrder = async () => {
    if (!session?.user) { setAuthPrompt(true); setTab('Account'); say('Sign in to place an order.','error'); return; }
    if (!selectedAddress) {setShowAddressForm(true);say('Add a delivery address before ordering.','error');return;}
    if (!count) return;
    if (payment !== 'cod') {say('Online UPI payment is not integrated yet. Choose cash on delivery for this test order.','error');return;}
    setBusy(true);setNotice('');
    const items = Object.entries(cart).map(([product_id,quantity]) => ({product_id,quantity}));
    const {data,error} = await supabase.rpc('create_order',{p_address_id:selectedAddress,p_items:items,p_payment_method:'cod',p_customer_note:null});
    setBusy(false);
    if (error) {say(error.message,'error');return;}
    setCart({});setShowCheckout(false);setTab('Orders');say('Order created in Supabase. The store still needs an order-management workflow before launch.','success');
    const {data:orderData,error:orderError} = await supabase.from('orders').select('id,order_number,status,payment_method,payment_status,total_paise,created_at,order_items(product_name,unit,quantity,line_total_paise)').eq('id',data?.[0]?.id).maybeSingle();
    if (!orderError && orderData) setOrders(old => [orderData,...old.filter(o => o.id !== orderData.id)]);
    await loadCatalogue();
  };

  return <div className="app-shell">
    <div className="announcement"><span className="pulse-dot" /> A LITTLE FASTER, A LOT CLOSER <span className="announce-city">· NANDURBAR</span></div>
    <header className="app-header">
      <button className="location-button" onClick={() => {setTab('Account');setAuthPrompt(!session);}} aria-label="View delivery address">
        <span className="location-icon"><MapPin size={18}/></span>
        <span className="location-copy"><small>DELIVERING TO <ChevronDown size={11}/></small><strong>{addresses.find(a=>a.id===selectedAddress)?.area || 'Nandurbar'}</strong></span>
      </button>
      <button className="avatar-button" onClick={() => switchTab('Account')} aria-label="Open account"><UserRound size={19}/></button>
    </header>

    {notice && <div className={'notice-bar ' + noticeKind} role="status"><span>{notice}</span><button onClick={()=>setNotice('')} aria-label="Dismiss message"><X size={15}/></button></div>}
    {!isSupabaseConfigured && <div className="setup-banner"><strong>Backend connection needed</strong><span>Configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to load the live catalogue.</span></div>}

    <main className="main-content">
      {tab === 'Home' && <>
        <section className="welcome-row"><div><p className="kicker">YOUR DAILY RUN, SHORTENED</p><h1>Good stuff.<br/><span>Quickly.</span></h1><p className="welcome-sub">Your everyday essentials, right around the corner.</p></div><div className="hero-art" aria-hidden="true"><span className="hero-spark">✳</span><span className="hero-basket">🛒</span><span className="hero-fruit">🥑</span></div></section>
        <div className="search-wrap"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search milk, fruits, snacks…" aria-label="Search products"/>{query&&<button className="clear-search" onClick={()=>setQuery('')} aria-label="Clear search"><X size={16}/></button>}<span className="search-divider"/><SlidersHorizontal size={17} className="filter-icon"/></div>
        <section className="delivery-strip"><div className="delivery-icon"><Bike size={20}/></div><div><strong>Local essentials, made easy</strong><small>{loading?'Loading live catalogue…':'Prices and availability from the catalogue'}</small></div><ArrowRight size={17}/></section>
        <section className="section-block"><div className="section-heading"><div><p className="kicker">THE GOOD STUFF</p><h2>Shop by category</h2></div><button className="text-button" onClick={()=>switchTab('Categories')}>View all <ArrowRight size={14}/></button></div>
          <div className="category-scroller">{categories.filter(c=>c.name!=='All items').slice(0,7).map(c=><button className={'category-tile '+(category===c.name?'selected':'')} key={c.id||c.name} onClick={()=>setCategory(c.name)}><span>{c.emoji||categoryEmoji[c.name]||'🛍️'}</span><small>{c.name}</small></button>)}</div>
        </section>
        <section className="section-block"><div className="section-heading"><div><p className="kicker">GOOD PICKS, EVERY DAY</p><h2>{query?'Search results':category==='All items'?'Popular near you':category}</h2></div><span className="result-count">{visibleProducts.length} items</span></div>
          {loading?<div className="empty-state"><span>🛒</span><strong>Loading the shelves…</strong><p>Fetching the current catalogue.</p></div>:<div className="product-grid">{visibleProducts.map(p=><ProductCard key={p.id} product={p} qty={cart[p.id]||0} onChange={changeQty} saved={saved.includes(p.id)} onSave={()=>setSaved(s=>s.includes(p.id)?s.filter(id=>id!==p.id):[...s,p.id])}/>)}</div>}
          {!loading&&!visibleProducts.length&&<div className="empty-state"><span>🔎</span><strong>{products.length?'No matches yet':'No products published yet'}</strong><p>{products.length?'Try another product or category.':'The store owner needs to add products to the catalogue.'}</p><button className="secondary-button" onClick={()=>{setQuery('');setCategory('All items')}}>Clear filters</button></div>}
        </section>
      </>}

      {tab==='Categories'&&<><PageTitle eyebrow="FIND YOUR FAVOURITES" title="All categories" subtitle="Browse the current store catalogue."/><div className="category-list">{categories.map(c=><button key={c.id||c.name} className="category-row" onClick={()=>{setCategory(c.name);setTab('Home')}}><span className="category-row-emoji">{c.emoji||categoryEmoji[c.name]||'🛍️'}</span><span>{c.name}</span><ArrowRight size={17}/></button>)}</div></>}

      {tab==='Cart'&&<><PageTitle eyebrow="YOUR BAG" title="The good stuff." subtitle={count?count+' item'+(count===1?'':'s')+' in your bag':'Your bag is taking a little breather.'}/>{count?<><div className="cart-list">{products.filter(p=>cart[p.id]).map(p=><CartRow key={p.id} product={p} qty={cart[p.id]} onChange={changeQty}/>)}</div><Bill subtotal={subtotal} delivery={delivery}/><button className="primary-button full-button" onClick={()=>{setShowCheckout(true);if(!session)setAuthPrompt(true)}}>Continue to checkout <ArrowRight size={17}/></button></>:<EmptyCart onBrowse={()=>switchTab('Home')}/>}</>}

      {tab==='Orders'&&<><PageTitle eyebrow="YOUR ORDERS" title="Your orders" subtitle={session?'Order history from your account.':'Sign in to see orders on your account.'}/>{orders.length?<div className="orders-stack">{orders.map(o=><article className="order-card" key={o.id}><div className="order-success"><PackageCheck size={22}/></div><div className="order-info"><span className="status-pill">{String(o.status||'placed').replaceAll('_',' ').toUpperCase()}</span><h3>Order {o.order_number}</h3><p>{money(rupees(o.total_paise))} · {o.payment_method==='cod'?'Cash on delivery':'UPI'} · {new Date(o.created_at).toLocaleDateString('en-IN')}</p><small>{(o.order_items||[]).map(i=>i.product_name+' × '+i.quantity).join(', ')}</small></div></article>)}</div>:<EmptyCart onBrowse={()=>switchTab('Home')} label={session?'No orders yet':'Sign in to view orders'} description={session?'Your confirmed orders will appear here.':'Your order history is linked to your account.'}/>}</>}

      {tab==='Account'&&<><PageTitle eyebrow="YOUR ZAP IT" title={session?'Your account':'Welcome to ZAP IT'} subtitle={session?'Your account and delivery details.':'Sign in to save addresses and place orders.'}/>
        {session?<><div className="account-card"><div className="account-avatar"><UserRound size={24}/></div><div><strong>{profile?.full_name||session.user.email}</strong><p>{session.user.email}</p><small>{profile?.phone||''}</small></div></div>
          <div className="section-heading address-heading"><div><p className="kicker">DELIVERY DETAILS</p><h2>Your addresses</h2></div><button className="text-button" onClick={()=>setShowAddressForm(v=>!v)}>{showAddressForm?'Cancel':'Add address'} <Plus size={14}/></button></div>
          {addresses.map(a=><button key={a.id} className={'saved-address '+(selectedAddress===a.id?'selected':'')} onClick={()=>setSelectedAddress(a.id)}><MapPin size={18}/><span><strong>{a.label} · {a.area}</strong><small>{a.address_line}, {a.city} · {a.phone}</small></span>{selectedAddress===a.id&&<Check size={17}/>}</button>)}
          {showAddressForm&&<AddressForm form={addressForm} setForm={setAddressForm} onSubmit={saveAddress} busy={busy}/>}
          <div className="settings-list"><button onClick={()=>switchTab('Orders')}><PackageCheck size={18}/> Your orders <ArrowRight size={16}/></button><button onClick={()=>say('Support contact will be published before launch.')}><ShieldCheck size={18}/> Help & support <ArrowRight size={16}/></button><button disabled={busy} onClick={signOut}><X size={18}/> Sign out <ArrowRight size={16}/></button></div></>
        :<AuthPanel mode={authMode} setMode={setAuthMode} form={authForm} setForm={setAuthForm} onSubmit={doAuth} busy={busy} prompt={authPrompt}/>}
        <p className="prototype-note">Stage 3 · Supabase-connected development build. Live delivery operations are not yet enabled.</p>
      </>}
    </main>

    <nav className="bottom-nav" aria-label="Main navigation">{[{name:'Home',icon:House},{name:'Categories',icon:LayoutGrid},{name:'Cart',icon:ShoppingBag},{name:'Orders',icon:PackageCheck},{name:'Account',icon:UserRound}].map(item=><button key={item.name} className={'nav-item '+(tab===item.name?'active':'')} onClick={()=>switchTab(item.name)}><span className="nav-icon-wrap"><item.icon size={20}/>{item.name==='Cart'&&count>0&&<i>{count}</i>}</span><small>{item.name}</small></button>)}</nav>
    {count>0&&tab==='Home'&&<button className="floating-cart" onClick={()=>switchTab('Cart')}><span className="floating-count">{count}</span><span><strong>View bag</strong><small>{money(subtotal)}{delivery?' + delivery':''}</small></span><ArrowRight size={18}/></button>}

    {showCheckout&&<div className="modal-backdrop" onClick={()=>setShowCheckout(false)}><section className="checkout-sheet" onClick={e=>e.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><div><p className="kicker">ALMOST THERE</p><h2>Checkout</h2></div><button className="icon-button" onClick={()=>setShowCheckout(false)} aria-label="Close checkout"><X size={20}/></button></div>
      <div className="checkout-section"><label>DELIVERY ADDRESS</label>{addresses.length?addresses.map(a=><button key={a.id} className={'address-option '+(selectedAddress===a.id?'chosen':'')} onClick={()=>setSelectedAddress(a.id)}><MapPin size={18}/><span><strong>{a.label} · {a.area}</strong><small>{a.address_line}, {a.city} · {a.phone}</small></span>{selectedAddress===a.id&&<Check size={17}/>}</button>):<><p className="checkout-hint">Add a saved address from your Account before ordering.</p><button className="secondary-button" onClick={()=>{setShowCheckout(false);setTab('Account');setShowAddressForm(true)}}>Add delivery address <ArrowRight size={15}/></button></>}</div>
      <div className="checkout-section"><label>PAYMENT METHOD</label><button className={'payment-option '+(payment==='cod'?'chosen':'')} onClick={()=>setPayment('cod')}><span className="payment-radio">{payment==='cod'&&<i/>}</span><span><strong>Cash on delivery</strong><small>Pay when your order arrives</small></span><span className="cod-mark">₹</span></button><button className={'payment-option '+(payment==='upi'?'chosen':'')} onClick={()=>setPayment('upi')}><span className="payment-radio">{payment==='upi'&&<i/>}</span><span><strong>UPI</strong><small>Unavailable until a payment provider is integrated</small></span><span className="upi-mark">UPI</span></button></div>
      <Bill subtotal={subtotal} delivery={delivery}/><div className="prototype-warning">Order totals and stock are validated by the database. This development build does not yet notify a store or guarantee delivery.</div><button className="primary-button full-button" disabled={busy||!count||!session||!selectedAddress||payment!=='cod'} onClick={placeOrder}>{busy?'Placing order…':'Place order · '+money(subtotal+delivery)} <ArrowRight size={17}/></button>
      {!session&&<button className="secondary-button full-button auth-checkout-button" onClick={()=>{setShowCheckout(false);setTab('Account');setAuthPrompt(true)}}>Sign in to continue</button>}
    </section></div>}
    <footer className="desktop-footer"><span className="footer-logo">ZAP<span>IT</span></span><span>MADE FOR NANDURBAR, WITH CARE.</span><span>STAGE 3 · CONNECTED DEVELOPMENT BUILD</span></footer>
  </div>;
}

function ProductCard({product:p,qty,onChange,saved,onSave}) {
  const unavailable = p.stock_quantity <= 0;
  return <article className="product-card"><div className="product-image" style={{'--item-color':p.color}}>{p.image_url?<img src={p.image_url} alt={p.name} loading="lazy"/>:<span className="product-emoji">{p.emoji||productEmoji(p.name)}</span>}{p.oldPrice&&<span className="deal-tag">DEAL</span>}<button className={'save-button '+(saved?'saved':'')} onClick={onSave} aria-label={saved?'Remove from favourites':'Save to favourites'}><Heart size={15} fill={saved?'currentColor':'none'}/></button></div><div className="product-details"><span className="product-category">{p.categoryName}</span><h3>{p.name}</h3><p className="product-unit">{p.unit} · {unavailable?'Out of stock':p.stock_quantity+' in stock'}</p><div className="product-bottom"><div className="price-stack"><strong>{money(p.price)}</strong>{p.oldPrice&&<del>{money(p.oldPrice)}</del>}</div>{qty===0?<button className="add-button" disabled={unavailable} onClick={()=>onChange(p.id,1)}>{unavailable?'SOLD OUT':'ADD'} {!unavailable&&<Plus size={14}/>}</button>:<div className="qty-control"><button onClick={()=>onChange(p.id,-1)} aria-label={'Remove one '+p.name}><Minus size={13}/></button><strong>{qty}</strong><button disabled={qty>=p.stock_quantity} onClick={()=>onChange(p.id,1)} aria-label={'Add one '+p.name}><Plus size={13}/></button></div>}</div></div></article>;
}
function CartRow({product:p,qty,onChange}) {
  return <div className="cart-row"><div className="cart-emoji" style={{background:p.color}}>{p.emoji||productEmoji(p.name)}</div><div className="cart-product-copy"><strong>{p.name}</strong><small>{p.unit}</small><b>{money(p.price*qty)}</b></div><div className="qty-control"><button onClick={()=>onChange(p.id,-1)} aria-label="Decrease quantity"><Minus size={13}/></button><strong>{qty}</strong><button disabled={qty>=p.stock_quantity} onClick={()=>onChange(p.id,1)} aria-label="Increase quantity"><Plus size={13}/></button></div></div>;
}
function Bill({subtotal,delivery}) {
  return <div className="bill"><div><span>Item total</span><strong>{money(subtotal)}</strong></div><div><span>Delivery fee</span><strong>{delivery===0?<em>FREE</em>:money(delivery)}</strong></div>{delivery>0&&<small>Add {money(199-subtotal)} more for free delivery.</small>}<div className="bill-total"><span>To pay</span><strong>{money(subtotal+delivery)}</strong></div></div>;
}
function PageTitle({eyebrow,title,subtitle}) { return <div className="page-title"><p className="kicker">{eyebrow}</p><h1>{title}</h1><p>{subtitle}</p></div>; }
function EmptyCart({onBrowse,label='Your bag is empty',description='A few everyday favourites would look good here.'}) { return <div className="empty-state"><span>🛍️</span><strong>{label}</strong><p>{description}</p><button className="primary-button" onClick={onBrowse}>Explore products <ArrowRight size={16}/></button></div>; }
function AuthPanel({mode,setMode,form,setForm,onSubmit,busy,prompt}) {
  return <form className="auth-panel" onSubmit={onSubmit}><div className="auth-switch"><button type="button" className={mode==='signin'?'chosen':''} onClick={()=>setMode('signin')}>Sign in</button><button type="button" className={mode==='signup'?'chosen':''} onClick={()=>setMode('signup')}>Create account</button></div><p className="auth-intro">{prompt?'Sign in or create an account to continue checkout.':'Save your addresses and keep your order history in one place.'}</p>{mode==='signup'&&<label>FULL NAME<input required autoComplete="name" value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} placeholder="Your name"/></label>}<label>EMAIL ADDRESS<input required type="email" autoComplete="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@example.com"/></label><label>PASSWORD<input required type="password" minLength={6} autoComplete={mode==='signup'?'new-password':'current-password'} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="At least 6 characters"/></label><button className="primary-button full-button" disabled={busy} type="submit">{busy?'Please wait…':mode==='signup'?'Create account':'Sign in'} <ArrowRight size={16}/></button><small className="auth-privacy">Your account is handled by Supabase Authentication. Never share your password with support.</small></form>;
}
function AddressForm({form,setForm,onSubmit,busy}) {
  const field=(key,label,placeholder,required=true,type='text')=><label>{label}<input type={type} required={required} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})} placeholder={placeholder}/></label>;
  return <form className="address-form" onSubmit={onSubmit}><p className="kicker">NEW DELIVERY ADDRESS</p><div className="address-fields">{field('label','LABEL','Home / Work')}{field('recipient_name','RECIPIENT NAME','Full name')}{field('phone','PHONE NUMBER','10-digit mobile number',true,'tel')}{field('address_line','HOUSE / STREET','House number and street')}{field('area','AREA / LOCALITY','Your Nandurbar area')}{field('landmark','LANDMARK (OPTIONAL)','Nearby landmark',false)}{field('pincode','PINCODE (OPTIONAL)','6-digit pincode',false)}</div><button className="primary-button full-button" disabled={busy} type="submit">{busy?'Saving…':'Save address'} <Check size={16}/></button></form>;
}
