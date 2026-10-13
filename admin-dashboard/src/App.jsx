import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, Boxes, Check, ChevronDown, CircleAlert, Clock3, IndianRupee, LogOut, Package, Plus, RefreshCw, Search, ShieldCheck, ShoppingBag, Truck, X } from 'lucide-react';
import { configured, supabase } from './lib/supabase.js';

const STATUSES = ['placed','confirmed','packing','out_for_delivery','delivered','cancelled'];
const money = paise => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(Number(paise||0)/100);
const dateTime = value => value ? new Date(value).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'}) : '—';
const friendly = value => String(value||'').replaceAll('_',' ');
const blankProduct = {name:'',slug:'',description:'',unit:'1 unit',category_id:'',price_rupees:'',mrp_rupees:'',stock_quantity:'0',image_url:'',is_active:true,is_featured:false};

export default function App(){
  const [session,setSession] = useState(null);
  const [role,setRole] = useState(null);
  const [email,setEmail] = useState('');
  const [password,setPassword] = useState('');
  const [tab,setTab] = useState('Overview');
  const [orders,setOrders] = useState([]);
  const [products,setProducts] = useState([]);
  const [categories,setCategories] = useState([]);
  const [search,setSearch] = useState('');
  const [statusFilter,setStatusFilter] = useState('all');
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState('');
  const [noticeType,setNoticeType] = useState('info');
  const [editing,setEditing] = useState(null);
  const [productForm,setProductForm] = useState(blankProduct);
  const [showProductForm,setShowProductForm] = useState(false);

  const message = (text,type='info') => {setNotice(text);setNoticeType(type);};
  const loadData = useCallback(async()=>{
    if(!supabase) return;
    const [o,p,c] = await Promise.all([
      supabase.from('orders').select('id,order_number,status,payment_method,payment_status,total_paise,subtotal_paise,delivery_fee_paise,created_at,delivery_address,profiles:profiles(full_name),order_items(product_name,unit,quantity,line_total_paise)').order('created_at',{ascending:false}).limit(150),
      supabase.from('products').select('id,name,slug,description,unit,category_id,price_paise,mrp_paise,stock_quantity,image_url,is_active,is_featured,created_at,category:categories(name)').order('name'),
      supabase.from('categories').select('id,name,sort_order,is_active').order('sort_order')
    ]);
    const firstError = o.error || p.error || c.error;
    if(firstError){message(firstError.message,'error');return;}
    setOrders(o.data||[]);setProducts(p.data||[]);setCategories(c.data||[]);
  },[]);
  const checkUser = useCallback(async(user)=>{
    if(!user || !supabase){setRole(null);return;}
    const {data,error} = await supabase.from('profiles').select('role,full_name').eq('id',user.id).maybeSingle();
    if(error){setRole('error');message(error.message,'error');return;}
    setRole(data?.role||'customer');
    if(data?.role==='admin') await loadData();
  },[loadData]);
  useEffect(()=>{
    if(!supabase) return;
    let alive=true;
    supabase.auth.getSession().then(({data})=>{if(alive){setSession(data.session);if(data.session?.user) checkUser(data.session.user);}});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{setSession(next);if(next?.user)setTimeout(()=>checkUser(next.user),0);else{setRole(null);setOrders([]);setProducts([]);}});
    return ()=>{alive=false;subscription.unsubscribe();};
  },[checkUser]);

  const metrics=useMemo(()=>{
    const today=new Date();today.setHours(0,0,0,0);
    const todayOrders=orders.filter(o=>new Date(o.created_at)>=today);
    const revenue=orders.filter(o=>o.status!=='cancelled'&&o.payment_status==='paid').reduce((sum,o)=>sum+Number(o.total_paise||0),0);
    return {total:orders.length,today:todayOrders.length,pending:orders.filter(o=>['placed','confirmed','packing'].includes(o.status)).length,revenue,low:products.filter(p=>p.is_active&&p.stock_quantity<=5).length};
  },[orders,products]);
  const filteredOrders=useMemo(()=>orders.filter(o=>{
    const text=[o.order_number,o.delivery_address?.recipient_name,o.delivery_address?.area,o.delivery_address?.phone].join(' ').toLowerCase();
    return (statusFilter==='all'||o.status===statusFilter)&&text.includes(search.toLowerCase());
  }),[orders,statusFilter,search]);
  const filteredProducts=useMemo(()=>products.filter(p=>[p.name,p.slug,p.category?.name].join(' ').toLowerCase().includes(search.toLowerCase())),[products,search]);

  async function signIn(e){e.preventDefault();if(!supabase)return;setBusy(true);message('');const {data,error}=await supabase.auth.signInWithPassword({email:email.trim(),password});setBusy(false);if(error){message(error.message,'error');return;}setSession(data.session);await checkUser(data.user);}
  async function signOut(){await supabase?.auth.signOut();setSession(null);setRole(null);setOrders([]);setProducts([]);}
  async function updateStatus(order,status){
    setBusy(true);const {error}=await supabase.from('orders').update({status,updated_at:new Date().toISOString()}).eq('id',order.id);setBusy(false);
    if(error){message(error.message,'error');return;}setOrders(old=>old.map(o=>o.id===order.id?{...o,status}:o));message(order.order_number+' updated to '+friendly(status)+'.','success');
  }
  function startAdd(){setEditing(null);setProductForm(blankProduct);setShowProductForm(true);}
  function startEdit(p){setEditing(p);setProductForm({name:p.name,slug:p.slug,description:p.description||'',unit:p.unit,category_id:p.category_id||'',price_rupees:String(p.price_paise/100),mrp_rupees:p.mrp_paise==null?'':String(p.mrp_paise/100),stock_quantity:String(p.stock_quantity),image_url:p.image_url||'',is_active:p.is_active,is_featured:p.is_featured});setShowProductForm(true);}
  async function saveProduct(e){
    e.preventDefault();if(!supabase)return;
    const price=Math.round(Number(productForm.price_rupees)*100),mrp=productForm.mrp_rupees===''?null:Math.round(Number(productForm.mrp_rupees)*100),stock=Number(productForm.stock_quantity);
    if(!productForm.name.trim()||!productForm.slug.trim()||!productForm.unit.trim()||!Number.isFinite(price)||price<0||!Number.isInteger(stock)||stock<0||(mrp!==null&&(!Number.isFinite(mrp)||mrp<price))){message('Check product name, slug, price, MRP and stock values.','error');return;}
    const payload={name:productForm.name.trim(),slug:productForm.slug.trim().toLowerCase(),description:productForm.description.trim(),unit:productForm.unit.trim(),category_id:productForm.category_id||null,price_paise:price,mrp_paise:mrp,stock_quantity:stock,image_url:productForm.image_url.trim()||null,is_active:Boolean(productForm.is_active),is_featured:Boolean(productForm.is_featured),updated_at:new Date().toISOString()};
    setBusy(true);
    const result=editing?await supabase.from('products').update(payload).eq('id',editing.id):await supabase.from('products').insert(payload);
    setBusy(false);if(result.error){message(result.error.message,'error');return;}
    setShowProductForm(false);message(editing?'Product updated.':'Product added.','success');await loadData();
  }
  async function toggleProduct(p){setBusy(true);const {error}=await supabase.from('products').update({is_active:!p.is_active,updated_at:new Date().toISOString()}).eq('id',p.id);setBusy(false);if(error){message(error.message,'error');return;}setProducts(old=>old.map(x=>x.id===p.id?{...x,is_active:!p.is_active}:x));}
  const setField=(key,value)=>setProductForm(old=>({...old,[key]:value}));

  if(!configured)return <div className="center-screen"><div className="login-card"><Brand/><h1>Connect your store</h1><p>Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in <code>.env.local</code>, then restart the dev server.</p></div></div>;
  if(!session)return <div className="center-screen"><form className="login-card" onSubmit={signIn}><Brand/><span className="eyebrow">STAFF ACCESS</span><h1>Store operations.</h1><p>Sign in with an approved ZAP IT administrator account.</p>{notice&&<div className={'notice '+noticeType}>{notice}</div>}<label>Email address<input type="email" required autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} placeholder="staff@example.com"/></label><label>Password<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Your password"/></label><button className="button primary full" disabled={busy}>{busy?'Signing in…':'Sign in securely'}</button><small>Admin access is controlled by your Supabase profile role and database policies.</small></form></div>;
  if(role==='customer')return <div className="center-screen"><div className="login-card"><Brand/><div className="denied-icon"><ShieldCheck/></div><h1>Staff access only.</h1><p>This account does not have the administrator role. Ask the project owner to grant access in Supabase. No customer data has been loaded.</p><button className="button secondary full" onClick={signOut}>Sign out</button></div></div>;
  if(role==='error')return <div className="center-screen"><div className="login-card"><Brand/><h1>Could not verify access</h1><p>Check your Supabase connection and profile policies.</p><button className="button secondary full" onClick={()=>checkUser(session.user)}>Try again</button></div></div>;
  if(!role)return <div className="center-screen"><div className="login-card"><Brand/><p>Verifying staff permissions…</p></div></div>;

  return <div className="dashboard">
    <aside className="sidebar"><Brand/><div className="store-chip"><span className="live-dot"/><span><b>Nandurbar store</b><small>Operations console</small></span></div><span className="nav-label">WORKSPACE</span><nav>{[['Overview',Activity],['Orders',ShoppingBag],['Products',Boxes]].map(([name,Icon])=><button key={name} className={tab===name?'active':''} onClick={()=>{setTab(name);setSearch('');}}><Icon size={18}/>{name}{name==='Orders'&&metrics.pending>0&&<span className="nav-count">{metrics.pending}</span>}</button>)}</nav><div className="sidebar-bottom"><div className="admin-avatar">{(session.user.email||'A').slice(0,1).toUpperCase()}</div><div className="admin-copy"><b>{session.user.email}</b><small>Administrator</small></div><button className="icon-button" title="Sign out" onClick={signOut}><LogOut size={17}/></button></div></aside>
    <main className="workspace"><header className="topbar"><div><span className="eyebrow">ZAP IT / OPERATIONS</span><h1>{tab}</h1></div><div className="top-actions"><span className="secure-label"><ShieldCheck size={15}/> Admin session</span><button className="button secondary" onClick={loadData} disabled={busy}><RefreshCw size={15}/> Refresh</button></div></header>
    {notice&&<div className={'notice global-notice '+noticeType}><span>{notice}</span><button onClick={()=>setNotice('')}><X size={15}/></button></div>}
    {tab==='Overview'&&<><section className="welcome-panel"><div><span className="eyebrow">STORE SNAPSHOT</span><h2>Good morning. <span>Let’s get moving.</span></h2><p>Here’s what needs attention across your Nandurbar store.</p></div><div className="welcome-mark">Z<span>.</span></div></section><section className="metric-grid"><Metric icon={ShoppingBag} label="All orders" value={metrics.total} note="Latest 150 orders" /><Metric icon={Clock3} label="Needs attention" value={metrics.pending} note="Placed, confirmed or packing" tone={metrics.pending?'warm':''}/><Metric icon={IndianRupee} label="Paid order value" value={money(metrics.revenue)} note="Only marked-paid orders" /><Metric icon={Boxes} label="Low stock" value={metrics.low} note="Active products with 5 or fewer" tone={metrics.low?'warm':''}/></section><section className="section-panel"><div className="panel-heading"><div><span className="eyebrow">LIVE QUEUE</span><h2>Recent orders</h2></div><button className="text-link" onClick={()=>setTab('Orders')}>View all <ArrowUpRight size={15}/></button></div><OrderTable orders={orders.slice(0,6)} busy={busy} onStatus={updateStatus}/></section><section className="attention-row"><div><CircleAlert size={20}/><div><b>Keep the catalogue accurate</b><p>Seed products and prices are for development only. Confirm real stock and supplier prices before accepting orders.</p></div></div><button className="button secondary" onClick={()=>setTab('Products')}>Manage products <ArrowDownRight size={15}/></button></section></>}
    {tab==='Orders'&&<section className="section-panel page-panel"><div className="panel-heading"><div><span className="eyebrow">FULFILMENT</span><h2>Order queue</h2><p>Update the status as each order moves through the store.</p></div><span className="count-pill">{filteredOrders.length} orders</span></div><div className="filters"><label className="search-box"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search order, customer, area…"/></label><select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="all">All statuses</option>{STATUSES.map(s=><option key={s} value={s}>{friendly(s)}</option>)}</select></div><OrderTable orders={filteredOrders} busy={busy} onStatus={updateStatus}/></section>}
    {tab==='Products'&&<section className="section-panel page-panel"><div className="panel-heading"><div><span className="eyebrow">CATALOGUE & INVENTORY</span><h2>Products</h2><p>Maintain price, availability and on-hand quantity.</p></div><button className="button primary" onClick={startAdd}><Plus size={16}/> Add product</button></div><label className="search-box product-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search products or categories…"/></label><div className="product-table-wrap"><table className="product-table"><thead><tr><th>PRODUCT</th><th>CATEGORY</th><th>PRICE</th><th>STOCK</th><th>STATUS</th><th></th></tr></thead><tbody>{filteredProducts.map(p=><tr key={p.id}><td><b>{p.name}</b><small>{p.unit} · {p.slug}</small></td><td>{p.category?.name||'Uncategorised'}</td><td><b>{money(p.price_paise)}</b>{p.mrp_paise&&<small className="muted"><s>{money(p.mrp_paise)}</s></small>}</td><td><span className={'stock-tag '+(p.stock_quantity<=5?'low':'')}>{p.stock_quantity} units</span></td><td><span className={'state-tag '+(p.is_active?'on':'off')}>{p.is_active?'Active':'Hidden'}</span></td><td><div className="row-actions"><button className="button mini secondary" onClick={()=>startEdit(p)}>Edit</button><button className="button mini ghost" disabled={busy} onClick={()=>toggleProduct(p)}>{p.is_active?'Hide':'Publish'}</button></div></td></tr>)}</tbody></table>{!filteredProducts.length&&<div className="empty">No matching products.</div>}</div></section>}
    <footer className="footnote"><ShieldCheck size={14}/> Protected by Supabase Row Level Security <span>·</span> Internal development tool</footer>
    </main>
    {showProductForm&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShowProductForm(false)}}><form className="product-modal" onSubmit={saveProduct}><header><div><span className="eyebrow">{editing?'EDIT CATALOGUE ITEM':'NEW CATALOGUE ITEM'}</span><h2>{editing?'Update product':'Add product'}</h2></div><button type="button" className="icon-button" onClick={()=>setShowProductForm(false)}><X size={18}/></button></header><div className="form-grid"><label>Product name<input required value={productForm.name} onChange={e=>setField('name',e.target.value)} placeholder="e.g. Fresh paneer"/></label><label>Unique slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={productForm.slug} onChange={e=>setField('slug',e.target.value)} placeholder="fresh-paneer"/></label><label>Category<select value={productForm.category_id} onChange={e=>setField('category_id',e.target.value)}><option value="">No category</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>Unit / pack size<input required value={productForm.unit} onChange={e=>setField('unit',e.target.value)} placeholder="500 g"/></label><label>Price (₹)<input required type="number" min="0" step="0.01" value={productForm.price_rupees} onChange={e=>setField('price_rupees',e.target.value)}/></label><label>MRP (₹, optional)<input type="number" min="0" step="0.01" value={productForm.mrp_rupees} onChange={e=>setField('mrp_rupees',e.target.value)}/></label><label>Stock quantity<input required type="number" min="0" step="1" value={productForm.stock_quantity} onChange={e=>setField('stock_quantity',e.target.value)}/></label><label>Image URL (optional)<input type="url" value={productForm.image_url} onChange={e=>setField('image_url',e.target.value)} placeholder="https://…"/></label><label className="span-two">Description<textarea rows="3" value={productForm.description} onChange={e=>setField('description',e.target.value)}/></label><label className="check-field"><input type="checkbox" checked={productForm.is_active} onChange={e=>setField('is_active',e.target.checked)}/> Published in customer catalogue</label><label className="check-field"><input type="checkbox" checked={productForm.is_featured} onChange={e=>setField('is_featured',e.target.checked)}/> Feature on customer home</label></div><div className="modal-actions"><button type="button" className="button secondary" onClick={()=>setShowProductForm(false)}>Cancel</button><button className="button primary" disabled={busy}>{busy?'Saving…':editing?'Save changes':'Create product'} <Check size={16}/></button></div></form></div>}
  </div>;
}
function Brand(){return <div className="brand"><span className="brand-mark">Z<span>.</span></span><span className="brand-word">ZAP IT<small>LOCAL COMMERCE</small></span></div>}
function Metric({icon:Icon,label,value,note,tone=''}){return <article className={'metric-card '+tone}><span className="metric-icon"><Icon size={19}/></span><span className="metric-label">{label}</span><strong>{value}</strong><small>{note}</small></article>}
function OrderTable({orders,busy,onStatus}){
 return <div className="orders-table-wrap"><table className="orders-table"><thead><tr><th>ORDER</th><th>CUSTOMER / DELIVERY</th><th>ITEMS</th><th>AMOUNT</th><th>PAYMENT</th><th>STATUS</th></tr></thead><tbody>{orders.map(o=><tr key={o.id}><td><b>{o.order_number}</b><small>{dateTime(o.created_at)}</small></td><td><b>{o.delivery_address?.recipient_name||'Customer'}</b><small>{[o.delivery_address?.area,o.delivery_address?.phone].filter(Boolean).join(' · ')||'Address unavailable'}</small></td><td><span className="item-summary">{(o.order_items||[]).map(i=>i.product_name+' × '+i.quantity).join(', ')||'—'}</span></td><td><b>{money(o.total_paise)}</b></td><td><span className={'payment-tag '+(o.payment_status==='paid'?'paid':'')}>{friendly(o.payment_method)} · {friendly(o.payment_status)}</span></td><td><select className={'status-select status-'+o.status} aria-label={'Status for '+o.order_number} disabled={busy||o.status==='cancelled'||o.status==='delivered'} value={o.status} onChange={e=>onStatus(o,e.target.value)}>{STATUSES.map(s=><option key={s} value={s}>{friendly(s)}</option>)}</select></td></tr>)}</tbody></table>{!orders.length&&<div className="empty"><Package size={24}/><b>No orders found</b><span>New customer orders will appear here.</span></div>}</div>
}