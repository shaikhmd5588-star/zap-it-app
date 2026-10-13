import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDownRight, ArrowUpRight, BadgeIndianRupee, Boxes, Check, ChevronDown,
  CircleAlert, Clock3, Command, Download, ExternalLink, Filter, LogOut, Package,
  PackageCheck, RefreshCw, Search, ShieldCheck, ShoppingBag, Truck, UserRound, X
} from 'lucide-react';
import { isConfigured, supabase } from './lib/supabase.js';

const STATUSES = ['placed','confirmed','packing','out_for_delivery','delivered','cancelled'];
const statusLabel = s => (s || 'placed').replaceAll('_',' ');
const money = paise => '₹' + (Number(paise || 0) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const shortDate = value => value ? new Date(value).toLocaleString('en-IN', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : '—';
const initials = value => (value || 'Z').trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()).join('');

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [checking, setChecking] = useState(true);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('Orders');
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState(null);
  const [busyId, setBusyId] = useState('');
  const [auth, setAuth] = useState({email:'',password:''});
  const [showInactive, setShowInactive] = useState(false);

  const notify = (message, type='info') => setNotice({message,type});
  const loadData = useCallback(async () => {
    if (!supabase || !session?.user) return;
    setLoading(true);
    const [orderRes, productRes] = await Promise.all([
      supabase.from('orders').select('id,order_number,user_id,address_id,delivery_address,status,payment_method,payment_status,subtotal_paise,delivery_fee_paise,total_paise,customer_note,created_at,updated_at,order_items(id,product_id,product_name,unit,unit_price_paise,quantity,line_total_paise)').order('created_at',{ascending:false}).limit(150),
      supabase.from('products').select('id,name,slug,description,unit,price_paise,mrp_paise,stock_quantity,is_active,is_featured,category:categories(name)').order('name')
    ]);
    if (orderRes.error) notify('Orders could not load: '+orderRes.error.message,'error');
    else {
      const rows = orderRes.data || [];
      setOrders(rows);
      const ids = [...new Set(rows.map(o=>o.user_id).filter(Boolean))];
      if (ids.length) {
        const p = await supabase.from('profiles').select('id,full_name,phone').in('id',ids);
        if (!p.error) setProfiles(Object.fromEntries((p.data||[]).map(x=>[x.id,x])));
      }
    }
    if (productRes.error) notify('Products could not load: '+productRes.error.message,'error');
    else setProducts(productRes.data || []);
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => {
    if (!supabase) { setChecking(false); return; }
    let alive = true;
    supabase.auth.getSession().then(async ({data,error}) => {
      if (!alive) return;
      if (error) notify(error.message,'error');
      setSession(data?.session || null);
      if (data?.session?.user) {
        const {data:row,error:profileError} = await supabase.from('profiles').select('id,full_name,role').eq('id',data.session.user.id).maybeSingle();
        if (!alive) return;
        if (profileError) notify(profileError.message,'error');
        setProfile(row || null);
      }
      setChecking(false);
    }).catch(e=>{if(alive){notify(e.message,'error');setChecking(false)}});
    const {data:{subscription}} = supabase.auth.onAuthStateChange((_event,next) => {
      setSession(next);
      if (!next) { setProfile(null);setOrders([]);setProducts([]);setProfiles({}); }
      else {
        setTimeout(async () => {
          const {data:row} = await supabase.from('profiles').select('id,full_name,role').eq('id',next.user.id).maybeSingle();
          setProfile(row || null);
        },0);
      }
    });
    return () => { alive=false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => { if (session?.user && profile?.role === 'admin') loadData(); }, [session?.user?.id,profile?.role,loadData]);

  const metrics = useMemo(() => ({
    today: orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString() && o.status !== 'cancelled'),
    active: orders.filter(o => !['delivered','cancelled'].includes(o.status)),
    revenue: orders.filter(o => o.status !== 'cancelled' && o.payment_status === 'paid').reduce((s,o)=>s+Number(o.total_paise||0),0),
    lowStock: products.filter(p=>p.is_active && p.stock_quantity<=5)
  }), [orders,products]);

  const filteredOrders = useMemo(() => orders.filter(o =>
    (filter==='all' || o.status===filter) &&
    [o.order_number,profiles[o.user_id]?.full_name,profiles[o.user_id]?.phone,o.delivery_address?.area,o.delivery_address?.address_line]
      .some(v=>String(v||'').toLowerCase().includes(search.toLowerCase()))
  ),[orders,filter,profiles,search]);

  const signIn = async e => {
    e.preventDefault(); if(!supabase) return;
    setBusyId('signin');setNotice(null);
    const {error} = await supabase.auth.signInWithPassword({email:auth.email.trim(),password:auth.password});
    setBusyId('');
    if(error) notify(error.message,'error');
  };
  const signOut = async () => { await supabase?.auth.signOut(); setProfile(null);setOrders([]);setProducts([]); };
  const updateStatus = async (order,next) => {
    if (next===order.status || !STATUSES.includes(next)) return;
    setBusyId(order.id);setNotice(null);
    const {error} = await supabase.from('orders').update({status:next,updated_at:new Date().toISOString()}).eq('id',order.id);
    setBusyId('');
    if(error) notify('Status update failed: '+error.message,'error');
    else { setOrders(old=>old.map(o=>o.id===order.id?{...o,status:next,updated_at:new Date().toISOString()}:o));notify(order.order_number+' moved to '+statusLabel(next)+'.','success'); }
  };
  const updateProduct = async (product, patch) => {
    setBusyId(product.id);setNotice(null);
    const {data,error} = await supabase.from('products').update({...patch,updated_at:new Date().toISOString()}).eq('id',product.id).select('id,name,slug,description,unit,price_paise,mrp_paise,stock_quantity,is_active,is_featured,category:categories(name)').single();
    setBusyId('');
    if(error) notify('Product update failed: '+error.message,'error');
    else { setProducts(old=>old.map(p=>p.id===product.id?data:p));notify(product.name+' saved.','success'); }
  };
  const exportOrders = () => {
    const csv = [
      ['Order','Created','Customer','Phone','Status','Payment method','Payment status','Subtotal INR','Delivery INR','Total INR','Area','Address'],
      ...filteredOrders.map(o=>[o.order_number,o.created_at,profiles[o.user_id]?.full_name||'',profiles[o.user_id]?.phone||'',o.status,o.payment_method,o.payment_status,(o.subtotal_paise/100).toFixed(2),(o.delivery_fee_paise/100).toFixed(2),(o.total_paise/100).toFixed(2),o.delivery_address?.area||'',o.delivery_address?.address_line||''])
    ].map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\r\n');
    const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
    const a=document.createElement('a');a.href=url;a.download='zapit-orders.csv';a.click();URL.revokeObjectURL(url);
  };

  if (!isConfigured) return <SetupScreen />;
  if (checking) return <div className="full-screen"><div className="loader-mark">Z<span>IT</span></div><p>Checking secure session…</p></div>;
  if (!session) return <LoginScreen auth={auth} setAuth={setAuth} onSubmit={signIn} busy={busyId==='signin'} notice={notice} />;
  if (profile?.role !== 'admin') return <div className="full-screen"><div className="denied-icon"><ShieldCheck size={28}/></div><p className="eyebrow">ACCESS CONTROL</p><h1>This account isn't an admin.</h1><p className="muted centered">ZAP IT store data is only available to a verified admin profile. Ask the project owner to grant the role in Supabase, then sign in again.</p><button className="button dark" onClick={signOut}><LogOut size={16}/> Sign out</button>{notice&&<Notice notice={notice}/>}</div>;

  return <div className="dashboard">
    <aside className="sidebar">
      <a className="brand" href="#" aria-label="ZAP IT dashboard"><span className="brand-symbol">Z</span><span>ZAP<span className="brand-acid">IT</span><small>STORE OPERATIONS</small></span></a>
      <div className="workspace-label">WORKSPACE <span>01</span></div>
      <nav className="side-nav">
        <button className={tab==='Orders'?'active':''} onClick={()=>setTab('Orders')}><ShoppingBag size={18}/>Orders <span className="nav-count">{metrics.active.length}</span></button>
        <button className={tab==='Inventory'?'active':''} onClick={()=>setTab('Inventory')}><Boxes size={18}/>Inventory {metrics.lowStock.length>0&&<span className="nav-alert">{metrics.lowStock.length}</span>}</button>
      </nav>
      <div className="sidebar-bottom"><div className="connection"><i/> SUPABASE CONNECTED</div><div className="admin-mini"><div className="avatar">{initials(profile.full_name||session.user.email)}</div><div><strong>{profile.full_name||'Store admin'}</strong><small>{session.user.email}</small></div><button title="Sign out" onClick={signOut}><LogOut size={16}/></button></div><small className="build-label">ZAP IT / INTERNAL PREVIEW</small></div>
    </aside>
    <main className="workspace">
      <header className="topbar"><div><p className="eyebrow">NANDURBAR · STORE CONSOLE</p><h1>{tab==='Orders'?'Order management':'Inventory control'}</h1></div><div className="top-actions"><span className="live-label"><i/> LIVE DATA</span><button className="button refresh" onClick={loadData} disabled={loading}><RefreshCw size={15} className={loading?'spin':''}/> {loading?'Refreshing':'Refresh'}</button><button className="icon-only mobile-signout" onClick={signOut} aria-label="Sign out"><LogOut size={17}/></button></div></header>
      {notice&&<Notice notice={notice} onClose={()=>setNotice(null)}/>}
      <section className="metrics-grid">
        <Metric icon={ShoppingBag} label="Orders today" value={metrics.today.length} note="Excluding cancelled" />
        <Metric icon={Activity} label="Open orders" value={metrics.active.length} note="Need fulfilment" />
        <Metric icon={BadgeIndianRupee} label="Paid revenue" value={money(metrics.revenue)} note="Confirmed payments only" />
        <Metric icon={CircleAlert} label="Low stock" value={metrics.lowStock.length} note="5 units or fewer" warning={metrics.lowStock.length>0}/>
      </section>
      {tab==='Orders' ? <section className="panel">
        <div className="panel-head"><div><p className="eyebrow">FULFILMENT QUEUE</p><h2>Incoming orders <span>{filteredOrders.length}</span></h2></div><div className="panel-tools"><label className="search-box"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search order, customer, area"/></label><button className="button outline" onClick={exportOrders}><Download size={15}/> Export CSV</button></div></div>
        <div className="filter-row"><Filter size={14}/>{['all',...STATUSES].map(s=><button key={s} className={filter===s?'selected':''} onClick={()=>setFilter(s)}>{s==='all'?'All orders':statusLabel(s)}{s==='all'&&<b>{orders.length}</b>}</button>)}</div>
        {loading&&!orders.length?<LoadingRows/>:filteredOrders.length===0?<Empty icon={PackageCheck} title="No orders in this view" copy={search?'Try a different search term.':'New customer orders will appear here when placed.'}/>:<div className="orders-list">{filteredOrders.map(o=><OrderRow key={o.id} order={o} customer={profiles[o.user_id]} busy={busyId===o.id} onStatus={s=>updateStatus(o,s)}/>)}</div>}
        <div className="panel-foot"><span>Showing {filteredOrders.length} of {orders.length} recent orders</span><span><ShieldCheck size={13}/> Updates are checked by Supabase RLS</span></div>
      </section> : <section className="panel">
        <div className="panel-head"><div><p className="eyebrow">CATALOGUE OPERATIONS</p><h2>Products & stock <span>{products.length}</span></h2></div><div className="panel-tools"><label className="search-box"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search product"/></label><label className="toggle"><input type="checkbox" checked={showInactive} onChange={e=>setShowInactive(e.target.checked)}/> Include hidden</label></div></div>
        <div className="inventory-table-wrap"><table className="inventory-table"><thead><tr><th>PRODUCT</th><th>SELLING PRICE</th><th>MRP</th><th>STOCK</th><th>LISTING</th><th>FEATURED</th><th/></tr></thead><tbody>{products.filter(p=>(showInactive||p.is_active)&&p.name.toLowerCase().includes(search.toLowerCase())).map(p=><ProductRow key={p.id} product={p} busy={busyId===p.id} onSave={updateProduct}/>)}</tbody></table></div>
        {!products.length&&<Empty icon={Boxes} title="No products found" copy="Published products will appear here."/>}
        <div className="panel-foot"><span>Changes save directly to the catalogue.</span><span><ShieldCheck size={13}/> Price and stock edits are admin-only</span></div>
      </section>}
      <footer className="workspace-footer"><span>© ZAP IT · INTERNAL OPERATIONS</span><span>Build stage 4 <i/> Not a public customer interface</span></footer>
    </main>
  </div>;
}

function SetupScreen(){return <div className="full-screen"><div className="loader-mark">Z<span>IT</span></div><h1>Connect the store console.</h1><p className="muted centered">Add the Supabase URL and public publishable key to <code>admin-app/.env.local</code>, then restart the development server.</p><code className="setup-code">VITE_SUPABASE_URL=…<br/>VITE_SUPABASE_PUBLISHABLE_KEY=…</code></div>}
function LoginScreen({auth,setAuth,onSubmit,busy,notice}){return <div className="login-layout"><div className="login-brand"><a className="brand" href="#"><span className="brand-symbol">Z</span><span>ZAP<span className="brand-acid">IT</span><small>STORE OPERATIONS</small></span></a><div className="login-copy"><p className="eyebrow">NANDURBAR · PRIVATE CONSOLE</p><h1>Run the store.<br/><span>Know the details.</span></h1><p>One clear view of orders, inventory, and the work between checkout and doorstep.</p><div className="login-stats"><span><PackageCheck size={17}/> Order queue</span><span><Boxes size={17}/> Stock control</span><span><ShieldCheck size={17}/> Role protected</span></div></div><small className="login-foot">ZAP IT / INTERNAL ACCESS ONLY</small></div><div className="login-form-side"><form className="login-card" onSubmit={onSubmit}><div className="lock-mark"><ShieldCheck size={22}/></div><p className="eyebrow">ADMIN SIGN IN</p><h2>Welcome back.</h2><p className="muted">Use your individually assigned admin account.</p>{notice&&<Notice notice={notice}/>}<label>EMAIL ADDRESS<input type="email" autoComplete="username" required value={auth.email} onChange={e=>setAuth({...auth,email:e.target.value})} placeholder="admin@yourstore.in"/></label><label>PASSWORD<input type="password" autoComplete="current-password" required value={auth.password} onChange={e=>setAuth({...auth,password:e.target.value})} placeholder="Your password"/></label><button className="button dark full" disabled={busy}>{busy?'Signing in…':'Sign in securely'} <ChevronDown size={16}/></button><p className="login-privacy"><ShieldCheck size={14}/> Access is verified against the Supabase admin role. No public admin registration.</p></form></div></div>}
function Metric({icon:Icon,label,value,note,warning}){return <article className={'metric '+(warning?'metric-warning':'')}><div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon size={17}/></span></div><strong>{value}</strong><small>{note}</small></article>}
function OrderRow({order:o,customer,busy,onStatus}){const [expanded,setExpanded]=useState(false);const address=o.delivery_address||{};return <article className={'order-row '+(expanded?'expanded':'')}><button className="order-main" onClick={()=>setExpanded(v=>!v)} aria-expanded={expanded}><span className="order-icon"><Package size={19}/></span><span className="order-primary"><strong>{o.order_number}</strong><small>{shortDate(o.created_at)} · {customer?.full_name||'Customer'}{customer?.phone?' · '+customer.phone:''}</small></span><span className={'status-tag status-'+o.status}>{statusLabel(o.status)}</span><span className="order-amount">{money(o.total_paise)}<small>{o.payment_method==='cod'?'Cash on delivery':'UPI'} · {o.payment_status}</small></span><ChevronDown size={17} className="row-chevron"/></button>{expanded&&<div className="order-detail"><div className="detail-grid"><div><p className="eyebrow">DELIVERY ADDRESS</p><strong>{address.recipient_name||customer?.full_name||'Customer'} · {address.phone||customer?.phone||'No phone saved'}</strong><p>{[address.address_line,address.landmark,address.area,address.city,address.pincode].filter(Boolean).join(', ')||'Address snapshot unavailable'}</p></div><div><p className="eyebrow">ORDER SUMMARY</p><div className="price-lines"><span>Items <b>{money(o.subtotal_paise)}</b></span><span>Delivery <b>{money(o.delivery_fee_paise)}</b></span><span className="grand-total">Total <b>{money(o.total_paise)}</b></span></div></div></div><div className="item-lines"><p className="eyebrow">ITEMS ({(o.order_items||[]).length})</p>{(o.order_items||[]).map(i=><div key={i.id}><span>{i.product_name} <small>{i.quantity} × {money(i.unit_price_paise)} / {i.unit}</small></span><strong>{money(i.line_total_paise)}</strong></div>)}</div>{o.customer_note&&<p className="customer-note">Customer note: {o.customer_note}</p>}<div className="status-controls"><label>UPDATE ORDER STATUS<select value={o.status} disabled={busy} onChange={e=>onStatus(e.target.value)}>{STATUSES.map(s=><option value={s} key={s}>{statusLabel(s)}</option>)}</select></label><span className="status-hint">{busy?'Saving status…':'Status changes are written to the database.'}</span></div></div>}</article>}
function ProductRow({product:p,busy,onSave}){const [price,setPrice]=useState((p.price_paise/100).toFixed(2));const [mrp,setMrp]=useState(p.mrp_paise?(p.mrp_paise/100).toFixed(2):'');const [stock,setStock]=useState(String(p.stock_quantity));const [active,setActive]=useState(p.is_active);const [featured,setFeatured]=useState(p.is_featured);useEffect(()=>{setPrice((p.price_paise/100).toFixed(2));setMrp(p.mrp_paise?(p.mrp_paise/100).toFixed(2):'');setStock(String(p.stock_quantity));setActive(p.is_active);setFeatured(p.is_featured)},[p.price_paise,p.mrp_paise,p.stock_quantity,p.is_active,p.is_featured]);const save=()=>{const priceNum=Number(price),mrpNum=mrp===''?null:Number(mrp),stockNum=Number(stock);if(!Number.isFinite(priceNum)||priceNum<0||!Number.isInteger(stockNum)||stockNum<0|| (mrpNum!==null&&(!Number.isFinite(mrpNum)||mrpNum<priceNum))){return alert('Enter valid values. MRP must be at least the selling price, and stock must be a non-negative whole number.')}onSave(p,{price_paise:Math.round(priceNum*100),mrp_paise:mrpNum===null?null:Math.round(mrpNum*100),stock_quantity:stockNum,is_active:active,is_featured:featured})};return <tr><td><div className="product-name"><span className="product-glyph">{p.category?.name?.includes('Dairy')?'🥛':p.category?.name?.includes('Fruit')?'🥦':'🛍️'}</span><span><strong>{p.name}</strong><small>{p.category?.name||'Uncategorised'} · {p.unit}</small></span></div></td><td><label className="money-input"><span>₹</span><input aria-label={p.name+' selling price'} type="number" min="0" step="0.01" value={price} onChange={e=>setPrice(e.target.value)}/></label></td><td><label className="money-input"><span>₹</span><input aria-label={p.name+' MRP'} type="number" min="0" step="0.01" value={mrp} onChange={e=>setMrp(e.target.value)} placeholder="—"/></label></td><td><input className="stock-input" aria-label={p.name+' stock quantity'} type="number" min="0" step="1" value={stock} onChange={e=>setStock(e.target.value)}/></td><td><button className={'switch '+(active?'on':'')} aria-label={active?'Hide product':'Publish product'} onClick={()=>setActive(v=>!v)}><i/></button></td><td><button className={'switch '+(featured?'on':'')} aria-label={featured?'Unfeature product':'Feature product'} onClick={()=>setFeatured(v=>!v)}><i/></button></td><td><button className="save-row" disabled={busy} onClick={save}>{busy?<RefreshCw size={14} className="spin"/>:<Check size={14}/>} Save</button></td></tr>}
function Notice({notice,onClose}){return <div className={'notice '+notice.type} role="status"><span>{notice.type==='error'?<CircleAlert size={16}/>:<Check size={16}/>}</span><p>{notice.message}</p>{onClose&&<button onClick={onClose} aria-label="Dismiss"><X size={15}/></button>}</div>}
function Empty({icon:Icon,title,copy}){return <div className="empty-state"><span><Icon size={25}/></span><strong>{title}</strong><p>{copy}</p></div>}
function LoadingRows(){return <div className="loading-rows">{[1,2,3,4].map(n=><div key={n}><i/><span/><span/><b/></div>)}</div>}
