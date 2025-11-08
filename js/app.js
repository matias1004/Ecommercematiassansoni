// app.js (module) - ProyectoFinal+Sansoni
// Simulador E-commerce: carga JSON, muestra catálogo, carrito, checkout simulado, persistencia

// Uso: abrir index.html (si fetch falla por CORS, arrancar servidor local simple: `python -m http.server`)

const LS_PRODUCTS = "pf:products";
const LS_CART = "pf:cart";

/* --------------------------------
   UTILIDADES Y COMPONENTES UI
   -------------------------------- */
const $ = id => document.getElementById(id);

// Mostrar modal simple (reemplaza alert/confirm/prompt)
const modal = {
  el: $("modal"),
  content: $("modalContent"),
  open(html) {
    this.content.innerHTML = html;
    this.el.classList.add("show");
    this.el.setAttribute("aria-hidden", "false");
  },
  close() {
    this.el.classList.remove("show");
    this.el.setAttribute("aria-hidden", "true");
  }
};

// handler close modal
$("modalClose").addEventListener("click", () => modal.close());
$("modal").addEventListener("click", (e) => {
  if (e.target === $("modal")) modal.close();
});

// formateador
const currency = v => `$ ${Number(v).toLocaleString('es-AR')}`;

/* --------------------------------
   CARGA DE DATOS (simula remoto)
   - primero intenta localStorage, si no fetch a data/products.json
   -------------------------------- */
async function loadProducts() {
  // si ya están en LS, devolver
  const raw = localStorage.getItem(LS_PRODUCTS);
  if (raw) {
    try { return JSON.parse(raw); } catch(e) {}
  }
  // fetch JSON local
  const resp = await fetch('data/products.json');
  const data = await resp.json();
  // guardar a LS copia para pruebas offline
  localStorage.setItem(LS_PRODUCTS, JSON.stringify(data));
  return data;
}

/* --------------------------------
   ESTADO: productos y carrito
   -------------------------------- */
let PRODUCTS = [];
let CART = []; // {id, qty}

function loadCartFromLS(){
  const raw = localStorage.getItem(LS_CART);
  CART = raw ? JSON.parse(raw) : [];
  renderCartCount();
}

/* --------------------------------
   RENDERS: catálogo y tarjetas (HTML generado desde JS)
   -------------------------------- */
function makeProductCard(p){
  const div = document.createElement('div');
  div.className = 'card-product';
  div.innerHTML = `
    <img src="${p.img}" alt="${p.title}">
    <div class="meta">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div><strong>${p.title}</strong> <span class="badge">${p.category}</span></div>
        <div class="price">${currency(p.price)}</div>
      </div>
      <div class="muted" style="margin-top:6px">${p.desc}</div>
      <div style="margin-top:8px;display:flex;gap:8px;align-items:center">
        <input type="number" min="1" max="${p.stock}" value="1" style="width:80px;padding:6px;border-radius:6px;border:1px solid rgba(255,255,255,0.04);background:transparent;color:inherit" data-product-qty />
        <button class="btn btn--ok" data-action="add" data-id="${p.id}">Agregar</button>
        <div class="muted" style="margin-left:auto">Stock: ${p.stock}</div>
      </div>
    </div>
  `;
  return div;
}

function renderCatalog(list){
  const grid = $("catalogGrid");
  grid.innerHTML = "";
  if (!list.length) {
    $("emptyCatalog").style.display = "block";
    return;
  } else $("emptyCatalog").style.display = "none";

  list.forEach(p => {
    grid.appendChild(makeProductCard(p));
  });
}

/* --------------------------------
   FILTROS, BUSQUEDA Y ORDEN
   -------------------------------- */
function populateCategories(products){
  const sel = $("filterCategory");
  const cats = Array.from(new Set(products.map(p => p.category))).sort();
  cats.forEach(c => {
    const o = document.createElement('option'); o.value = c; o.textContent = c;
    sel.appendChild(o);
  });
}

function getFilters(){
  return {
    q: $("search").value.trim().toLowerCase(),
    category: $("filterCategory").value,
    minPrice: Number($("minPrice").value) || 0,
    maxPrice: Number($("maxPrice").value) || 0,
    sort: $("sort").value
  };
}

function applyFiltersAndRender(){
  const f = getFilters();
  let out = PRODUCTS.slice();

  if (f.q) {
    out = out.filter(p => p.title.toLowerCase().includes(f.q) || p.desc.toLowerCase().includes(f.q));
  }
  if (f.category) out = out.filter(p => p.category === f.category);
  if (f.minPrice) out = out.filter(p => p.price >= f.minPrice);
  if (f.maxPrice) out = out.filter(p => p.price <= f.maxPrice);

  // ordenar
  if (f.sort === 'price-asc') out.sort((a,b)=>a.price-b.price);
  if (f.sort === 'price-desc') out.sort((a,b)=>b.price-a.price);
  if (f.sort === 'name-asc') out.sort((a,b)=>a.title.localeCompare(b.title));

  renderCatalog(out);
}

/* --------------------------------
   EVENTOS: delegación para agregar productos desde el grid
   -------------------------------- */
document.addEventListener('click', (e) => {
  const addBtn = e.target.closest('button[data-action="add"]');
  if (addBtn) {
    const id = addBtn.dataset.id;
    const card = addBtn.closest('.card-product');
    const qtyInput = card.querySelector('[data-product-qty]');
    let qty = Number(qtyInput.value) || 1;
    addToCart(id, qty);
  }
});

/* --------------------------------
   CARRITO: funciones
   -------------------------------- */
function findProduct(id){ return PRODUCTS.find(p=>p.id===id); }

function addToCart(id, qty = 1){
  const prod = findProduct(id);
  if (!prod) { modal.open(`<p>Producto no encontrado.</p>`); return; }
  const exist = CART.find(it => it.id === id);
  const currentQtyInCart = exist ? exist.qty : 0;
  if (currentQtyInCart + qty > prod.stock){
    modal.open(`<p>No hay suficiente stock. Stock disponible: ${prod.stock - currentQtyInCart}</p>`);
    return;
  }
  if (exist) exist.qty += qty; else CART.push({id, qty});
  saveCart();
  renderCartCount();
  modal.open(`<p>Agregaste <strong>${qty} x ${prod.title}</strong> al carrito.</p>`);
}

function saveCart(){
  localStorage.setItem(LS_CART, JSON.stringify(CART));
}

function renderCartCount(){
  const total = CART.reduce((s,c)=> s + c.qty, 0);
  $("cartCount").textContent = total;
}

/* --------------------------------
   MODAL CARRITO / CHECKOUT
   -------------------------------- */
function openCartModal(){
  if (CART.length === 0) {
    modal.open(`<h3>Carrito</h3><p class="muted">Tu carrito está vacío.</p>`);
    return;
  }
  // construir tabla
  let html = `<h3>Carrito</h3><table class="table"><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Total</th><th></th></tr></thead><tbody>`;
  let total = 0;
  CART.forEach(it => {
    const p = findProduct(it.id);
    const sub = p.price * it.qty;
    total += sub;
    html += `<tr data-id="${it.id}">
      <td>${p.title}</td>
      <td><input type="number" min="1" max="${p.stock}" value="${it.qty}" style="width:70px" data-cart-qty /></td>
      <td>${currency(p.price)}</td>
      <td>${currency(sub)}</td>
      <td><button class="btn small" data-action="remove">❌</button></td>
    </tr>`;
  });
  html += `</tbody></table>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px">
      <div><strong>Total: ${currency(total)}</strong></div>
      <div><button id="btnClearCart" class="btn small">Vaciar</button> <button id="btnCheckout" class="btn btn--ok small">Checkout</button></div>
    </div>`;
  modal.open(html);

  // attach listeners inside modal
  modal.content.querySelectorAll('[data-action="remove"]').forEach(b => {
    b.addEventListener('click', (e) => {
      const tr = e.target.closest('tr');
      const id = tr.dataset.id;
      CART = CART.filter(x => x.id !== id);
      saveCart(); renderCartCount(); openCartModal(); // reabrir para refrescar
    });
  });

  modal.content.querySelectorAll('input[data-cart-qty]').forEach(inp => {
    inp.addEventListener('change', (e) => {
      const tr = e.target.closest('tr');
      const id = tr.dataset.id;
      const val = Number(e.target.value) || 1;
      const p = findProduct(id);
      if (val > p.stock){ e.target.value = p.stock; return; }
      const item = CART.find(x=>x.id===id);
      if (item) item.qty = val;
      saveCart(); renderCartCount(); openCartModal();
    });
  });

  modal.content.querySelector('#btnClearCart')?.addEventListener('click', () => {
    if (!confirmAction("¿Vaciar el carrito?")) return;
    CART = []; saveCart(); renderCartCount(); openCartModal();
  });

  modal.content.querySelector('#btnCheckout')?.addEventListener('click', () => {
    // abrir formulario de checkout dentro del modal
    openCheckoutForm();
  });
}

// simple confirm usando modal (no alert)
function confirmAction(text){
  // devuelve boolean usando window.confirm para simplicidad de UX (puedes reemplazar por modal más complejo)
  return window.confirm(text);
}

/* --------------------------------
   CHECKOUT simulado (entrada-procesamiento-salida)
   - pre-carga datos ejemplo (sugerencia de consigna)
   - valida tarjeta (simulada), realiza "compra" y actualiza stock
   - guarda histórico (opcional)
   -------------------------------- */
function openCheckoutForm(){
  // prefill ejemplo
  const prefill = { name: "Matias Sansoni", email: "matias@example.com", address: "Calle Falsa 123" };
  const html = `
    <h3>Checkout</h3>
    <form id="checkoutForm">
      <label>Nombre completo</label><input id="c_name" value="${prefill.name}" required />
      <label>Email</label><input id="c_email" value="${prefill.email}" required />
      <label>Dirección</label><input id="c_address" value="${prefill.address}" required />
      <label>Método de pago</label>
      <select id="c_method">
        <option value="card">Tarjeta</option>
        <option value="cash">Efectivo (simulado)</option>
      </select>
      <div id="cardBox" style="margin-top:8px">
        <label>Nº Tarjeta</label><input id="c_card" placeholder="1111 2222 3333 4444" />
        <label>CVV</label><input id="c_cvv" placeholder="123" style="width:100px" />
      </div>
      <div style="margin-top:12px;display:flex;gap:8px;justify-content:flex-end">
        <button type="button" id="btnCancelCheckout" class="btn small">Cancelar</button>
        <button type="submit" class="btn btn--ok small">Pagar</button>
      </div>
    </form>
  `;
  modal.open(html);

  document.getElementById('btnCancelCheckout').addEventListener('click', () => { modal.close(); });

  document.getElementById('checkoutForm').addEventListener('submit', (e) => {
    e.preventDefault();
    // validar datos mínimos
    const name = document.getElementById('c_name').value.trim();
    const email = document.getElementById('c_email').value.trim();
    const address = document.getElementById('c_address').value.trim();
    const method = document.getElementById('c_method').value;
    if (!name || !email || !address) { modal.open('<p class="muted">Completá todos los campos.</p>'); return; }

    // simulación de pago: si tarjeta, validar formato simple
    if (method === 'card') {
      const card = document.getElementById('c_card').value.replace(/\s/g,'');
      const cvv = document.getElementById('c_cvv').value.trim();
      if (!/^\d{16}$/.test(card) || !/^\d{3,4}$/.test(cvv)) {
        modal.open('<p class="muted">Datos de tarjeta inválidos (ej. 16 dígitos y CVV 3-4 dígitos).</p>'); return;
      }
    }

    // procesamiento: actualizar stock y vaciar carrito
    let outOfStock = false;
    CART.forEach(it => {
      const p = findProduct(it.id);
      if (it.qty > p.stock) outOfStock = true;
    });
    if (outOfStock) { modal.open('<p>Algún producto superó el stock. Actualizá cantidades.</p>'); return; }

    // restar stock
    CART.forEach(it => {
      const p = findProduct(it.id);
      p.stock -= it.qty;
    });

    // almacenar productos actualizados en LS
    localStorage.setItem(LS_PRODUCTS, JSON.stringify(PRODUCTS));

    // "guardar orden": simple simulación guardada en LS (historial opcional)
    const orders = JSON.parse(localStorage.getItem('pf:orders') || '[]');
    const order = {
      id: 'ord-' + Date.now(),
      name, email, address, method,
      items: CART.map(it => ({ id: it.id, qty: it.qty })),
      date: new Date().toISOString()
    };
    orders.push(order);
    localStorage.setItem('pf:orders', JSON.stringify(orders));

    // vaciar carrito
    CART = []; saveCart(); renderCartCount();

    // cerrar y mostrar confirmación
    modal.open(`<h3>Compra realizada</h3><p>Gracias ${name}! Tu compra fue procesada (simulada). ID pedido: <strong>${order.id}</strong></p>`);
    // re-render catálogo para actualizar stocks visibles
    applyFiltersAndRender();
  });
}

/* --------------------------------
   INICIALIZACION: carga y bind UI
   -------------------------------- */
async function init(){
  PRODUCTS = await loadProducts();
  populateCategories(PRODUCTS);
  renderCatalog(PRODUCTS);
  loadCartFromLS();

  // listeners UI
  $("search").addEventListener('input', debounce(applyFiltersAndRender, 300));
  $("sort").addEventListener('change', applyFiltersAndRender);
  $("filterCategory").addEventListener('change', applyFiltersAndRender);
  $("btnApplyFilters").addEventListener('click', applyFiltersAndRender);
  $("btnResetFilters").addEventListener('click', () => {
    $("filterCategory").value = ""; $("minPrice").value = ""; $("maxPrice").value = ""; $("search").value = "";
    applyFiltersAndRender();
  });

  $("btnCart").addEventListener('click', openCartModal);

  // delegación: inputs de cantidad y botones dentro del grid generados
  // (se manejan por event delegation global ya más arriba para addToCart)

  // ensure modal close exists
  $("modalClose").addEventListener('click', () => modal.close());
}

// helper debounce
function debounce(fn, wait){
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(()=> fn(...args), wait);
  };
}

init();
