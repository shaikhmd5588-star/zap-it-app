import { useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Check, ChevronDown, Clock3, MapPin, Minus, Plus,
  Search, ShoppingBag, SlidersHorizontal, Sparkles, UserRound, X, House,
  LayoutGrid, PackageCheck, Heart, Bike, ShieldCheck
} from 'lucide-react';

const products = [
  { id: 1, name: 'Amul Taaza Milk', unit: '500 ml', price: 29, oldPrice: 32, category: 'Dairy', emoji: '🥛', color: '#e8f3ff', popular: true },
  { id: 2, name: 'Farm Fresh Bananas', unit: '6 pieces', price: 39, oldPrice: 45, category: 'Fruits & Veg', emoji: '🍌', color: '#fff4c7', popular: true },
  { id: 3, name: 'Potatoes', unit: '1 kg', price: 32, category: 'Fruits & Veg', emoji: '🥔', color: '#f1e8dc', popular: true },
  { id: 4, name: 'Red Tomatoes', unit: '500 g', price: 24, category: 'Fruits & Veg', emoji: '🍅', color: '#ffe6df' },
  { id: 5, name: 'Aashirvaad Atta', unit: '5 kg', price: 245, oldPrice: 269, category: 'Staples', emoji: '🌾', color: '#f5ead2' },
  { id: 6, name: 'Basmati Rice', unit: '1 kg', price: 119, category: 'Staples', emoji: '🍚', color: '#e9e8df' },
  { id: 7, name: 'Instant Noodles', unit: 'Pack of 4', price: 56, category: 'Snacks', emoji: '🍜', color: '#ffebd7', popular: true },
  { id: 8, name: 'Laundry Detergent', unit: '1 kg', price: 105, category: 'Home Care', emoji: '🧺', color: '#e8e7ff' },
  { id: 9, name: 'Brown Bread', unit: '400 g', price: 42, category: 'Bakery', emoji: '🍞', color: '#f7e6d5' },
  { id: 10, name: 'Fresh Eggs', unit: '6 pieces', price: 48, category: 'Dairy', emoji: '🥚', color: '#fff0d6' },
  { id: 11, name: 'Orange Juice', unit: '1 L', price: 89, category: 'Beverages', emoji: '🧃', color: '#ffe5c2' },
  { id: 12, name: 'Potato Chips', unit: 'Pack', price: 20, category: 'Snacks', emoji: '🥔', color: '#fff0c5' }
];
const categories = [
  { name: 'All items', emoji: '🛍️' }, { name: 'Fruits & Veg', emoji: '🥦' },
  { name: 'Dairy', emoji: '🥛' }, { name: 'Staples', emoji: '🌾' },
  { name: 'Snacks', emoji: '🍪' }, { name: 'Beverages', emoji: '🧃' },
  { name: 'Bakery', emoji: '🍞' }, { name: 'Home Care', emoji: '🧼' }
];
const money = n => '₹' + n.toLocaleString('en-IN');

export default function App() {
  const [cart, setCart] = useState({});
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All items');
  const [tab, setTab] = useState('Home');
  const [showCheckout, setShowCheckout] = useState(false);
  const [address, setAddress] = useState('Home · Nandurbar');
  const [payment, setPayment] = useState('Cash on delivery');
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');
  const [completedOrderTotal, setCompletedOrderTotal] = useState(0);
  const [completedOrderPayment, setCompletedOrderPayment] = useState('Cash on delivery');
  const [saved, setSaved] = useState([]);
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const subtotal = products.reduce((sum, p) => sum + p.price * (cart[p.id] || 0), 0);
  const delivery = subtotal === 0 || subtotal >= 199 ? 0 : 25;
  const visibleProducts = useMemo(() => products.filter(p =>
    (category === 'All items' || p.category === category) &&
    (p.name.toLowerCase().includes(query.toLowerCase()) || p.category.toLowerCase().includes(query.toLowerCase()))
  ), [category, query]);

  const changeQty = (id, delta) => setCart(current => {
    const next = { ...current };
    const amount = (next[id] || 0) + delta;
    if (amount <= 0) delete next[id]; else next[id] = amount;
    return next;
  });
  const switchTab = name => { setTab(name); if (name === 'Categories') setCategory('All items'); if (name === 'Cart') setShowCheckout(false); };
  const startOrder = () => {
    if (!count) return;
    setOrderNumber('ZP' + Math.floor(100000 + Math.random() * 900000));
    setCompletedOrderTotal(subtotal + delivery);
    setCompletedOrderPayment(payment);
    setOrderPlaced(true);
    setShowCheckout(false);
    setCart({});
    setTab('Orders');
  };

  return <div className="app-shell">
    <div className="announcement"><span className="pulse-dot" /> A LITTLE FASTER, A LOT CLOSER <span className="announce-city">· NANDURBAR</span></div>
    <header className="app-header">
      <button className="location-button" onClick={() => setAddress(address.startsWith('Home') ? 'Work · Nandurbar' : 'Home · Nandurbar')} aria-label="Change delivery address">
        <span className="location-icon"><MapPin size={18} /></span>
        <span className="location-copy"><small>DELIVERING TO <ChevronDown size={11} /></small><strong>{address}</strong></span>
      </button>
      <button className="avatar-button" onClick={() => switchTab('Account')} aria-label="Open account"><UserRound size={19}/></button>
    </header>

    <main className="main-content">
      {tab === 'Home' && <>
        <section className="welcome-row"><div><p className="kicker">YOUR DAILY RUN, SHORTENED</p><h1>Good stuff.<br/><span>Quickly.</span></h1><p className="welcome-sub">Your everyday essentials, right around the corner.</p></div><div className="hero-art" aria-hidden="true"><span className="hero-spark">✳</span><span className="hero-basket">🛒</span><span className="hero-fruit">🥑</span></div></section>
        <div className="search-wrap"><Search size={19}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search milk, fruits, snacks…" aria-label="Search products"/>{query && <button className="clear-search" onClick={() => setQuery('')} aria-label="Clear search"><X size={16}/></button>}<span className="search-divider"/><SlidersHorizontal size={17} className="filter-icon"/></div>
        <section className="delivery-strip"><div className="delivery-icon"><Bike size={20}/></div><div><strong>Local essentials, made easy</strong><small>Delivery estimate shown at checkout</small></div><ArrowRight size={17}/></section>
        <section className="section-block"><div className="section-heading"><div><p className="kicker">THE GOOD STUFF</p><h2>Shop by category</h2></div><button className="text-button" onClick={() => switchTab('Categories')}>View all <ArrowRight size={14}/></button></div>
          <div className="category-scroller">{categories.slice(1,7).map(c => <button className={'category-tile ' + (category === c.name ? 'selected' : '')} key={c.name} onClick={() => setCategory(c.name)}><span>{c.emoji}</span><small>{c.name}</small></button>)}</div>
        </section>
        <section className="section-block"><div className="section-heading"><div><p className="kicker">GOOD PICKS, EVERY DAY</p><h2>{query ? 'Search results' : category === 'All items' ? 'Popular near you' : category}</h2></div><span className="result-count">{visibleProducts.length} items</span></div>
          <div className="product-grid">{visibleProducts.map(p => <ProductCard key={p.id} product={p} qty={cart[p.id] || 0} onChange={changeQty} saved={saved.includes(p.id)} onSave={() => setSaved(s => s.includes(p.id) ? s.filter(id => id !== p.id) : [...s, p.id])}/>)}</div>
          {!visibleProducts.length && <div className="empty-state"><span>🔎</span><strong>No matches yet</strong><p>Try another product or category.</p><button className="secondary-button" onClick={() => {setQuery('');setCategory('All items')}}>Clear filters</button></div>}
        </section>
      </>}

      {tab === 'Categories' && <><PageTitle eyebrow="FIND YOUR FAVOURITES" title="All categories" subtitle="A little something for every list."/><div className="category-list">{categories.map(c => <button key={c.name} className="category-row" onClick={() => {setCategory(c.name);setTab('Home')}}><span className="category-row-emoji">{c.emoji}</span><span>{c.name}</span><ArrowRight size={17}/></button>)}</div></>}

      {tab === 'Cart' && <><PageTitle eyebrow="YOUR BAG" title="The good stuff." subtitle={count ? count + ' item' + (count === 1 ? '' : 's') + ' in your bag' : 'Your bag is taking a little breather.'}/>{count ? <><div className="cart-list">{products.filter(p => cart[p.id]).map(p => <CartRow key={p.id} product={p} qty={cart[p.id]} onChange={changeQty}/>)}</div><Bill subtotal={subtotal} delivery={delivery}/><button className="primary-button full-button" onClick={() => setShowCheckout(true)}>Continue to checkout <ArrowRight size={17}/></button></> : <EmptyCart onBrowse={() => switchTab('Home')}/>}</>}

      {tab === 'Orders' && <><PageTitle eyebrow="YOUR ORDERS" title={orderPlaced ? 'Order received.' : 'Your orders'} subtitle={orderPlaced ? 'Your demo order has been created on this device.' : 'Your recent orders will show up here.'}/>{orderPlaced ? <div className="order-card"><div className="order-success"><Check size={22}/></div><div className="order-info"><span className="status-pill">DEMO ORDER · PLACED</span><h3>Order {orderNumber}</h3><p>{money(completedOrderTotal)} · {completedOrderPayment}</p><small>This is a local prototype only. No store has received this order.</small></div></div> : <EmptyCart onBrowse={() => switchTab('Home')} label="No orders yet" description="When you place an order, you’ll find its status here."/>}</>}

      {tab === 'Account' && <><PageTitle eyebrow="YOUR ZAP IT" title="Hello there." subtitle="Your essentials, your way."/><div className="account-card"><div className="account-avatar"><UserRound size={24}/></div><div><strong>Guest shopper</strong><p>Sign-in will be added in a later stage.</p></div></div><div className="settings-list"><button onClick={() => setAddress(address.startsWith('Home') ? 'Work · Nandurbar' : 'Home · Nandurbar')}><MapPin size={18}/> Delivery address <span>{address}<ChevronDown size={14}/></span></button><button onClick={() => switchTab('Orders')}><PackageCheck size={18}/> Your orders <ArrowRight size={16}/></button><button onClick={() => alert('Help and support will be connected before launch.')}><ShieldCheck size={18}/> Help & support <ArrowRight size={16}/></button></div><p className="prototype-note">Stage 1 prototype · Sample prices and products · Not accepting real orders.</p></>}
    </main>

    <nav className="bottom-nav" aria-label="Main navigation">{[{name:'Home',icon:House},{name:'Categories',icon:LayoutGrid},{name:'Cart',icon:ShoppingBag},{name:'Orders',icon:PackageCheck},{name:'Account',icon:UserRound}].map(item => <button key={item.name} className={'nav-item ' + (tab === item.name ? 'active' : '')} onClick={() => switchTab(item.name)}><span className="nav-icon-wrap"><item.icon size={20}/>{item.name === 'Cart' && count > 0 && <i>{count}</i>}</span><small>{item.name}</small></button>)}</nav>

    {count > 0 && tab === 'Home' && <button className="floating-cart" onClick={() => switchTab('Cart')}><span className="floating-count">{count}</span><span><strong>View bag</strong><small>{money(subtotal)}{delivery ? ' + delivery' : ''}</small></span><ArrowRight size={18}/></button>}

    {showCheckout && <div className="modal-backdrop" onClick={() => setShowCheckout(false)}><section className="checkout-sheet" onClick={e => e.stopPropagation()}><div className="sheet-handle"/><div className="sheet-title"><div><p className="kicker">ALMOST THERE</p><h2>Checkout</h2></div><button className="icon-button" onClick={() => setShowCheckout(false)} aria-label="Close checkout"><X size={20}/></button></div><div className="checkout-section"><label>DELIVERY ADDRESS</label><button className="address-option" onClick={() => setAddress(address.startsWith('Home') ? 'Work · Nandurbar' : 'Home · Nandurbar')}><MapPin size={18}/><span><strong>{address}</strong><small>Tap to switch saved demo address</small></span><ChevronDown size={17}/></button></div><div className="checkout-section"><label>PAYMENT METHOD</label>{['Cash on delivery','UPI (demo selection)'].map(method => <button key={method} className={'payment-option ' + (payment === method ? 'chosen' : '')} onClick={() => setPayment(method)}><span className="payment-radio">{payment === method && <i/>}</span><span><strong>{method}</strong><small>{method.startsWith('UPI') ? 'Payment integration is not connected yet' : 'Pay when your order arrives'}</small></span>{method.startsWith('UPI') ? <span className="upi-mark">UPI</span> : <span className="cod-mark">₹</span>}</button>)}</div><Bill subtotal={subtotal} delivery={delivery}/><div className="prototype-warning">Prototype only: placing this demo order does not contact a store or collect payment.</div><button className="primary-button full-button" onClick={startOrder}>Place demo order · {money(subtotal + delivery)} <ArrowRight size={17}/></button></section></div>}
    <footer className="desktop-footer"><span className="footer-logo">ZAP<span>IT</span></span><span>MADE FOR NANDURBAR, WITH CARE.</span><span>STAGE 1 · INTERACTIVE PROTOTYPE</span></footer>
  </div>;
}

function ProductCard({product:p, qty, onChange, saved, onSave}) {
  return <article className="product-card"><div className="product-image" style={{'--item-color':p.color}}><span className="product-emoji">{p.emoji}</span>{p.oldPrice && <span className="deal-tag">DEAL</span>}<button className={'save-button ' + (saved ? 'saved' : '')} onClick={onSave} aria-label={saved ? 'Remove from favourites' : 'Save to favourites'}><Heart size={15} fill={saved ? 'currentColor' : 'none'}/></button></div><div className="product-details"><span className="product-category">{p.category}</span><h3>{p.name}</h3><p className="product-unit">{p.unit}</p><div className="product-bottom"><div className="price-stack"><strong>{money(p.price)}</strong>{p.oldPrice && <del>{money(p.oldPrice)}</del>}</div>{qty === 0 ? <button className="add-button" onClick={() => onChange(p.id, 1)}>ADD <Plus size={14}/></button> : <div className="qty-control"><button onClick={() => onChange(p.id, -1)} aria-label={'Remove one ' + p.name}><Minus size={13}/></button><strong>{qty}</strong><button onClick={() => onChange(p.id, 1)} aria-label={'Add one ' + p.name}><Plus size={13}/></button></div>}</div></div></article>;
}
function CartRow({product:p, qty, onChange}) {
  return <div className="cart-row"><div className="cart-emoji" style={{background:p.color}}>{p.emoji}</div><div className="cart-product-copy"><strong>{p.name}</strong><small>{p.unit}</small><b>{money(p.price * qty)}</b></div><div className="qty-control"><button onClick={() => onChange(p.id,-1)} aria-label="Decrease quantity"><Minus size={13}/></button><strong>{qty}</strong><button onClick={() => onChange(p.id,1)} aria-label="Increase quantity"><Plus size={13}/></button></div></div>;
}
function Bill({subtotal, delivery}) {
  return <div className="bill"><div><span>Item total</span><strong>{money(subtotal)}</strong></div><div><span>Delivery fee</span><strong>{delivery === 0 ? <em>FREE</em> : money(delivery)}</strong></div>{delivery > 0 && <small>Add {money(199-subtotal)} more for free delivery (demo rule).</small>}<div className="bill-total"><span>To pay</span><strong>{money(subtotal+delivery)}</strong></div></div>;
}
function PageTitle({eyebrow,title,subtitle}) {
  return <div className="page-title"><p className="kicker">{eyebrow}</p><h1>{title}</h1><p>{subtitle}</p></div>;
}
function EmptyCart({onBrowse,label='Your bag is empty',description='A few everyday favourites would look good here.'}) {
  return <div className="empty-state"><span>🛍️</span><strong>{label}</strong><p>{description}</p><button className="primary-button" onClick={onBrowse}>Explore products <ArrowRight size={16}/></button></div>;
}
