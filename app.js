/* ============================================================
   LK Mart — app.js
   Handles: Auth, Products (Firestore), UI interactions
   Features: Quantity, Out-of-Stock, Location Filter, Search
   ============================================================ */

'use strict';

// ────────────────────────────────────────────────────────────
//  HELPERS
// ────────────────────────────────────────────────────────────

/** Format number as Indian Rupees */
function formatINR(amount) {
  return '₹' + Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
}

/** Calculate commission rate and amount */
function calcCommission(sellerPrice) {
  const price = parseFloat(sellerPrice) || 0;
  const rate  = price > 5000 ? 0.10 : 0.05;
  const comm  = parseFloat((price * rate).toFixed(2));
  const final = parseFloat((price + comm).toFixed(2));
  return { rate, comm, final, isPremium: price > 5000 };
}

/** Show toast */
function showToast(msg, type = 'info') {
  const wrap = document.getElementById('toast-wrap');
  if (!wrap) return;
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  wrap.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.4s';
    setTimeout(() => el.remove(), 400);
  }, 3000);
}

/** Show / hide alert box */
function setAlert(id, msg, type = 'error') {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `alert-box show alert-${type}`;
  el.textContent = msg;
}

function clearAlert(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = 'alert-box';
  el.textContent = '';
}

/** Set loading state on a button */
function setLoading(btnId, textId, spinnerId, loading) {
  const btn     = document.getElementById(btnId);
  const text    = document.getElementById(textId);
  const spinner = document.getElementById(spinnerId);
  if (!btn) return;
  btn.disabled = loading;
  if (text)    text.classList.toggle('hidden', loading);
  if (spinner) spinner.classList.toggle('hidden', !loading);
}

/** Validate email format */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** Validate URL (optional field) */
function isValidUrl(url) {
  if (!url.trim()) return true;
  try { new URL(url); return true; } catch { return false; }
}

/** XSS protection */
function esc(str) {
  return String(str ?? '')
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

// ────────────────────────────────────────────────────────────
//  DETECT CURRENT PAGE
// ────────────────────────────────────────────────────────────

const IS_LOGIN     = document.getElementById('login-form')     !== null;
const IS_DASHBOARD = document.getElementById('section-shop')   !== null;

// ============================================================
//  LOGIN PAGE  (index.html)
// ============================================================
if (IS_LOGIN) {

  let currentRole = 'buyer';

  document.querySelectorAll('.role-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.role-tab').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      currentRole = btn.dataset.role;
      clearAlert('login-alert');
    });
  });

  function validateLoginForm() {
    let valid = true;

    const emailInput = document.getElementById('email-input');
    const emailErr   = document.getElementById('email-error');
    if (!isValidEmail(emailInput.value)) {
      emailInput.classList.add('is-error');
      emailErr.classList.add('show');
      valid = false;
    } else {
      emailInput.classList.remove('is-error');
      emailErr.classList.remove('show');
    }

    const passInput = document.getElementById('password-input');
    const passErr   = document.getElementById('password-error');
    if (passInput.value.length < 6) {
      passInput.classList.add('is-error');
      passErr.classList.add('show');
      valid = false;
    } else {
      passInput.classList.remove('is-error');
      passErr.classList.remove('show');
    }

    return valid;
  }

  let isRegisterMode = false;

  function updateLoginUI() {
    const loginText = document.getElementById('login-btn-text');
    const regBtn    = document.getElementById('register-btn');
    if (isRegisterMode) {
      loginText.textContent = 'Create Account';
      regBtn.textContent    = 'Back to Login';
    } else {
      loginText.textContent = 'Login';
      regBtn.textContent    = 'Create Account';
    }
    clearAlert('login-alert');
  }

  document.getElementById('register-btn').addEventListener('click', () => {
    isRegisterMode = !isRegisterMode;
    updateLoginUI();
  });

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAlert('login-alert');

    if (!validateLoginForm()) return;

    const email    = document.getElementById('email-input').value.trim();
    const password = document.getElementById('password-input').value;

    setLoading('login-btn', 'login-btn-text', 'login-btn-spinner', true);

    try {
      let userCred;
      if (isRegisterMode) {
        userCred = await auth.createUserWithEmailAndPassword(email, password);
        await db.collection('users').doc(userCred.user.uid).set({
          email,
          role: currentRole,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      } else {
        userCred = await auth.signInWithEmailAndPassword(email, password);
      }

      localStorage.setItem('lkmart_role', currentRole);
      window.location.href = 'dashboard.html';

    } catch (err) {
      const msgs = {
        'auth/user-not-found':       'No account found with this email.',
        'auth/wrong-password':       'Incorrect password. Please try again.',
        'auth/email-already-in-use': 'This email is already registered. Please login.',
        'auth/invalid-email':        'Invalid email address.',
        'auth/weak-password':        'Password must be at least 6 characters.',
        'auth/too-many-requests':    'Too many attempts. Please wait and try again.',
        'auth/network-request-failed': 'Network error. Check your internet connection.',
        'auth/invalid-credential':   'Invalid email or password. Please check and try again.'
      };
      setAlert('login-alert', msgs[err.code] || err.message, 'error');
    } finally {
      setLoading('login-btn', 'login-btn-text', 'login-btn-spinner', false);
    }
  });

  auth.onAuthStateChanged(user => {
    if (user) window.location.href = 'dashboard.html';
  });

} // end IS_LOGIN


// ============================================================
//  DASHBOARD PAGE  (dashboard.html)
// ============================================================
if (IS_DASHBOARD) {

  function hideLoading() {
    const ls = document.getElementById('loading-screen');
    if (!ls) return;
    setTimeout(() => {
      ls.style.opacity = '0';
      ls.style.transition = 'opacity 0.4s';
      setTimeout(() => ls.remove(), 400);
    }, 900);
  }

  // ── Auth guard ──
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = 'index.html';
      return;
    }

    let role = localStorage.getItem('lkmart_role') || 'buyer';
    try {
      const snap = await db.collection('users').doc(user.uid).get();
      if (snap.exists && snap.data().role) role = snap.data().role;
    } catch (_) {}

    const emailEl = document.getElementById('nav-user-email');
    const roleEl  = document.getElementById('nav-role-badge');
    if (emailEl) emailEl.textContent = user.email;
    if (roleEl)  roleEl.textContent  = role.toUpperCase();

    const addTab      = document.getElementById('tab-add');
    const listingsTab = document.getElementById('tab-listings');
    if (role === 'buyer') {
      if (addTab)      addTab.style.display      = 'none';
      if (listingsTab) listingsTab.style.display = 'none';
    }

    initDashboard(user, role);
    hideLoading();
  });

  // ── Logout ──
  document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
      await auth.signOut();
      localStorage.removeItem('lkmart_role');
      window.location.href = 'index.html';
    } catch (err) {
      showToast('Logout failed. Try again.', 'error');
    }
  });

  // ──────────────────────────────────────────────────────────
  //  TABS
  // ──────────────────────────────────────────────────────────
  const SECTIONS = {
    shop:     document.getElementById('section-shop'),
    add:      document.getElementById('section-add'),
    listings: document.getElementById('section-listings')
  };

  function switchTab(tabName) {
    document.querySelectorAll('.dash-tab').forEach(btn => {
      const isActive = btn.dataset.tab === tabName;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    Object.entries(SECTIONS).forEach(([name, el]) => {
      if (!el) return;
      if (name === tabName) {
        el.classList.add('active');
        el.style.display = '';
      } else {
        el.classList.remove('active');
        el.style.display = 'none';
      }
    });
  }

  document.querySelectorAll('.dash-tab').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  switchTab('shop');

  // ──────────────────────────────────────────────────────────
  //  MAIN INIT
  // ──────────────────────────────────────────────────────────
  function initDashboard(user, role) {
    loadAllProducts();
    if (role === 'seller') {
      loadMyListings(user.uid);
      initAddProductForm(user.uid);
    }
    initModal();
    initSearchAndFilter();
    initClearForm();
  }

  // ──────────────────────────────────────────────────────────
  //  ALL PRODUCTS — stored globally for search/filter
  // ──────────────────────────────────────────────────────────
  let _allProducts = [];

  function loadAllProducts() {
    const grid       = document.getElementById('products-grid');
    const countLabel = document.getElementById('products-count');

    db.collection('products')
      .onSnapshot(snapshot => {
        _allProducts = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const ta = a.createdAt ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt ? b.createdAt.toMillis() : 0;
            return tb - ta;
          });

        updateLocationFilter(_allProducts);
        applySearchAndFilter();
        updateStats(_allProducts);
      }, err => {
        if (grid) grid.innerHTML = `<div class="empty-state"><p style="color:#e53935;">Error loading products: ${err.message}</p></div>`;
      });
  }

  function renderShopGrid(products) {
    const grid = document.getElementById('products-grid');
    if (!grid) return;

    if (!products.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">&#128722;</div>
          <h3>No products found</h3>
          <p>Try a different search or filter.</p>
        </div>`;
      return;
    }

    grid.innerHTML = products.map(p => buildBuyerCard(p)).join('');

    grid.querySelectorAll('.js-buy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.productId;
        const p  = _allProducts.find(x => x.id === id);
        if (p) openModal(p);
      });
    });
  }

  // ──────────────────────────────────────────────────────────
  //  BUILD BUYER CARD — includes quantity + out-of-stock
  // ──────────────────────────────────────────────────────────
  function buildBuyerCard(p) {
    const { final, isPremium } = calcCommission(p.sellerPrice);
    const qty       = typeof p.quantity !== 'undefined' ? parseInt(p.quantity) : null;
    const outOfStock = qty !== null && qty <= 0;

    const imgBlock = p.imageUrl
      ? `<img
           src="${esc(p.imageUrl)}"
           alt="${esc(p.name)}"
           loading="lazy"
           class="card-real-img"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
         />
         <div class="img-placeholder" style="display:none;">
           <span>&#128247;</span>No Image
         </div>`
      : `<div class="img-placeholder">
           <span>&#128247;</span>No Image
         </div>`;

    const qtyBadge = outOfStock
      ? `<span class="qty-badge out-of-stock">Out of Stock</span>`
      : qty !== null
        ? `<span class="qty-badge in-stock">Qty: ${qty}</span>`
        : '';

    const buyBtn = outOfStock
      ? `<button class="btn-buy-now btn-disabled" disabled>Out of Stock</button>`
      : `<button class="btn-buy-now js-buy-btn" data-product-id="${esc(p.id)}">Buy Now</button>`;

    return `
      <div class="product-card${outOfStock ? ' card-oos' : ''}">
        <div class="card-img-wrap">
          ${imgBlock}
          <span class="card-tag">Direct Seller</span>
          ${isPremium ? '<span class="card-tag premium">Premium</span>' : ''}
          ${outOfStock ? '<span class="card-tag oos-tag">Out of Stock</span>' : ''}
        </div>
        <div class="card-body">
          <div class="card-name" title="${esc(p.name)}">${esc(p.name)}</div>
          <div class="card-location">&#128205; ${esc(p.location)}</div>
          <div class="card-price">${formatINR(final)}</div>
          ${qtyBadge}
          <div class="card-seller-label">&#10003; Direct Seller Product</div>
          <div class="card-delivery">&#128666; Delivery charges vary based on location</div>
          ${buyBtn}
          <button class="btn-add-cart" onclick="showToast('Added to cart (demo)', 'info')">Add to Cart</button>
        </div>
      </div>`;
  }

  // ──────────────────────────────────────────────────────────
  //  MY LISTINGS
  // ──────────────────────────────────────────────────────────
  function loadMyListings(uid) {
    const count = document.getElementById('listings-count');

    db.collection('products')
      .where('sellerId', '==', uid)
      .onSnapshot(snapshot => {
        const products = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const ta = a.createdAt ? a.createdAt.toMillis() : 0;
            const tb = b.createdAt ? b.createdAt.toMillis() : 0;
            return tb - ta;
          });
        if (count) count.textContent = `${products.length} product${products.length !== 1 ? 's' : ''}`;
        renderListingsGrid(products);
      });
  }

  function renderListingsGrid(products) {
    const grid = document.getElementById('listings-grid');
    if (!grid) return;

    if (!products.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">&#128196;</div>
          <h3>No listings yet</h3>
          <p>Go to "Add Product" to list your first product.</p>
        </div>`;
      return;
    }

    grid.innerHTML = products.map(p => buildSellerCard(p)).join('');

    grid.querySelectorAll('.js-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteProduct(btn.dataset.productId));
    });

    grid.querySelectorAll('.js-qty-up').forEach(btn => {
      btn.addEventListener('click', () => updateQty(btn.dataset.productId, 1));
    });

    grid.querySelectorAll('.js-qty-down').forEach(btn => {
      btn.addEventListener('click', () => updateQty(btn.dataset.productId, -1));
    });
  }

  // ──────────────────────────────────────────────────────────
  //  BUILD SELLER CARD — shows real prices + quantity controls
  // ──────────────────────────────────────────────────────────
  function buildSellerCard(p) {
    const { comm, final, rate, isPremium } = calcCommission(p.sellerPrice);
    const qty       = typeof p.quantity !== 'undefined' ? parseInt(p.quantity) : 0;
    const outOfStock = qty <= 0;

    const imgBlock = p.imageUrl
      ? `<img
           src="${esc(p.imageUrl)}"
           alt="${esc(p.name)}"
           loading="lazy"
           class="card-real-img"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
         />
         <div class="img-placeholder" style="display:none;">
           <span>&#128247;</span>No Image
         </div>`
      : `<div class="img-placeholder">
           <span>&#128247;</span>No Image
         </div>`;

    return `
      <div class="product-card${outOfStock ? ' card-oos' : ''}">
        <div class="card-img-wrap">
          ${imgBlock}
          <span class="card-tag">Direct Seller</span>
          ${isPremium ? '<span class="card-tag premium">Premium</span>' : ''}
          ${outOfStock ? '<span class="card-tag oos-tag">Out of Stock</span>' : ''}
        </div>
        <div class="card-body">
          <div class="card-name" title="${esc(p.name)}">${esc(p.name)}</div>
          <div class="card-location">&#128205; ${esc(p.location)}</div>
          <div class="seller-card-price-row">
            <div>
              <div class="seller-price-label">Your Price</div>
              <div class="seller-price-val">${formatINR(p.sellerPrice)}</div>
            </div>
            <div>
              <div class="seller-price-label">Commission (${rate * 100}%)</div>
              <div class="seller-comm-val">+ ${formatINR(comm)}</div>
            </div>
            <div>
              <div class="seller-price-label">Buyer Sees</div>
              <div class="seller-final-val">${formatINR(final)}</div>
            </div>
          </div>

          <!-- Quantity controls -->
          <div class="qty-control-row">
            <span class="qty-control-label">Stock:</span>
            <button class="qty-btn js-qty-down" data-product-id="${esc(p.id)}" ${qty <= 0 ? 'disabled' : ''}>−</button>
            <span class="qty-display ${outOfStock ? 'qty-oos' : ''}">${qty}</span>
            <button class="qty-btn js-qty-up" data-product-id="${esc(p.id)}">+</button>
            ${outOfStock ? '<span class="oos-label">Out of Stock</span>' : ''}
          </div>

          <button class="btn-delete js-delete-btn" data-product-id="${esc(p.id)}">&#128465; Delete Listing</button>
        </div>
      </div>`;
  }

  // ──────────────────────────────────────────────────────────
  //  UPDATE QUANTITY
  // ──────────────────────────────────────────────────────────
  async function updateQty(productId, delta) {
    try {
      const ref  = db.collection('products').doc(productId);
      const snap = await ref.get();
      if (!snap.exists) return;
      const currentQty = parseInt(snap.data().quantity) || 0;
      const newQty     = Math.max(0, currentQty + delta);
      await ref.update({
        quantity:    newQty,
        inStock:     newQty > 0
      });
      showToast(`Stock updated to ${newQty}.`, 'success');
    } catch (err) {
      showToast('Failed to update stock: ' + err.message, 'error');
    }
  }

  // ──────────────────────────────────────────────────────────
  //  DELETE PRODUCT
  // ──────────────────────────────────────────────────────────
  async function deleteProduct(productId) {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await db.collection('products').doc(productId).delete();
      showToast('Product deleted successfully.', 'success');
    } catch (err) {
      showToast('Failed to delete: ' + err.message, 'error');
    }
  }

  // ──────────────────────────────────────────────────────────
  //  ADD PRODUCT FORM
  // ──────────────────────────────────────────────────────────
  function initAddProductForm(uid) {
    const priceInput = document.getElementById('prod-price');

    if (priceInput) {
      priceInput.addEventListener('input', updateCommissionPreview);
    }

    function updateCommissionPreview() {
      const price = parseFloat(priceInput.value);
      const box   = document.getElementById('commission-box');
      if (!price || price <= 0) { if (box) box.classList.remove('show'); return; }
      const { rate, comm, final } = calcCommission(price);
      document.getElementById('cb-seller-price').textContent = formatINR(price);
      document.getElementById('cb-comm-label').textContent   = `Commission (${rate * 100}%)`;
      document.getElementById('cb-commission').textContent   = formatINR(comm);
      document.getElementById('cb-final').textContent        = formatINR(final);
      if (box) box.classList.add('show');
    }

    // ── Image Upload Setup ──
    let _selectedFile   = null;
    let _uploadedImgUrl = '';

    const fileInput     = document.getElementById('prod-img-file');
    const pickBtn       = document.getElementById('img-pick-btn');
    const dropZone      = document.getElementById('img-drop-zone');
    const previewWrap   = document.getElementById('img-preview-wrap');
    const previewImg    = document.getElementById('img-preview');
    const removeBtn     = document.getElementById('img-remove-btn');
    const uploadBox     = document.getElementById('img-upload-box');
    const progressWrap  = document.getElementById('upload-progress');
    const progressBar   = document.getElementById('upload-progress-bar');
    const progressLabel = document.getElementById('upload-progress-label');

    if (pickBtn)  pickBtn.addEventListener('click',  () => fileInput && fileInput.click());
    if (dropZone) dropZone.addEventListener('click', (e) => {
      if (e.target !== pickBtn) fileInput && fileInput.click();
    });

    if (fileInput) {
      fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files[0]) handleFileSelected(fileInput.files[0]);
      });
    }

    if (uploadBox) {
      uploadBox.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadBox.classList.add('dragover');
      });
      uploadBox.addEventListener('dragleave', () => uploadBox.classList.remove('dragover'));
      uploadBox.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadBox.classList.remove('dragover');
        const file = e.dataTransfer.files && e.dataTransfer.files[0];
        if (file) handleFileSelected(file);
      });
    }

    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        _selectedFile   = null;
        _uploadedImgUrl = '';
        if (fileInput)    fileInput.value            = '';
        if (previewWrap)  previewWrap.style.display  = 'none';
        if (dropZone)     dropZone.style.display      = 'flex';
        if (progressWrap) progressWrap.style.display  = 'none';
        if (progressBar)  progressBar.style.width     = '0%';
      });
    }

    function handleFileSelected(file) {
      if (!file.type.startsWith('image/')) {
        showToast('Please select an image file (JPG, PNG, WEBP).', 'error');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showToast('Image too large. Maximum size is 5 MB.', 'error');
        return;
      }
      _selectedFile   = file;
      _uploadedImgUrl = '';
      const reader = new FileReader();
      reader.onload = (e) => {
        if (previewImg)  previewImg.src            = e.target.result;
        if (previewWrap) previewWrap.style.display = 'block';
        if (dropZone)    dropZone.style.display     = 'none';
      };
      reader.readAsDataURL(file);
    }

    // ── Cloudinary Config ──
    const CLOUDINARY_CLOUD  = 'dktv09vry';
    const CLOUDINARY_PRESET = 'lkmart_upload';

    async function uploadImageToStorage() {
      if (!_selectedFile) return '';

      if (progressWrap) {
        progressWrap.style.display = 'block';
        progressBar.style.width    = '0%';
        progressLabel.textContent  = 'Uploading… 0%';
      }

      const formData = new FormData();
      formData.append('file',           _selectedFile);
      formData.append('upload_preset',  CLOUDINARY_PRESET);
      formData.append('folder',         'lkmart_products');

      let fakeProgress = 0;
      const fakeTimer = setInterval(() => {
        if (fakeProgress < 85) {
          fakeProgress += Math.random() * 12;
          if (progressBar)   progressBar.style.width    = Math.min(fakeProgress, 85) + '%';
          if (progressLabel) progressLabel.textContent  = `Uploading… ${Math.round(Math.min(fakeProgress, 85))}%`;
        }
      }, 300);

      try {
        const res  = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
          { method: 'POST', body: formData }
        );
        const data = await res.json();
        clearInterval(fakeTimer);

        if (data.secure_url) {
          if (progressBar)   progressBar.style.width    = '100%';
          if (progressLabel) progressLabel.textContent  = 'Upload complete ✓';
          setTimeout(() => {
            if (progressWrap) progressWrap.style.display = 'none';
            if (progressBar)  progressBar.style.width    = '0%';
          }, 800);
          return data.secure_url;
        } else {
          throw new Error(data.error?.message || 'Upload failed');
        }
      } catch (err) {
        clearInterval(fakeTimer);
        if (progressWrap) progressWrap.style.display = 'none';
        throw err;
      }
    }

    // ── Form Submit ──
    document.getElementById('add-product-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAlert('add-alert');

      if (!validateAddForm()) return;

      const name     = document.getElementById('prod-name').value.trim();
      const price    = parseFloat(document.getElementById('prod-price').value);
      const location = document.getElementById('prod-location').value.trim();
      const urlInput = document.getElementById('prod-img').value.trim();
      const qty      = parseInt(document.getElementById('prod-qty').value) || 0;

      const { comm, final, isPremium } = calcCommission(price);

      setLoading('add-product-btn', 'add-btn-text', 'add-btn-spinner', true);

      try {
        let imageUrl = urlInput;
        if (_selectedFile) {
          try {
            imageUrl = await uploadImageToStorage();
            _uploadedImgUrl = imageUrl;
          } catch (uploadErr) {
            setAlert('add-alert', 'Image upload failed: ' + uploadErr.message, 'error');
            setLoading('add-product-btn', 'add-btn-text', 'add-btn-spinner', false);
            return;
          }
        }

        await db.collection('products').add({
          name,
          sellerPrice: price,
          commission:  comm,
          finalPrice:  final,
          isPremium,
          location,
          quantity:    qty,
          inStock:     qty > 0,
          imageUrl:    imageUrl || '',
          sellerId:    uid,
          createdAt:   firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast(`"${name}" added successfully!`, 'success');

        document.getElementById('add-product-form').reset();
        document.getElementById('commission-box').classList.remove('show');
        _selectedFile   = null;
        _uploadedImgUrl = '';
        if (fileInput)    fileInput.value            = '';
        if (previewWrap)  previewWrap.style.display  = 'none';
        if (dropZone)     dropZone.style.display      = 'flex';

        switchTab('listings');

      } catch (err) {
        setAlert('add-alert', 'Failed to add product: ' + err.message, 'error');
      } finally {
        setLoading('add-product-btn', 'add-btn-text', 'add-btn-spinner', false);
      }
    });
  }

  function validateAddForm() {
    let valid = true;

    const name    = document.getElementById('prod-name');
    const nameErr = document.getElementById('prod-name-error');
    if (!name.value.trim()) {
      name.classList.add('is-error');
      nameErr.classList.add('show');
      valid = false;
    } else {
      name.classList.remove('is-error');
      nameErr.classList.remove('show');
    }

    const price    = document.getElementById('prod-price');
    const priceErr = document.getElementById('prod-price-error');
    if (!price.value || parseFloat(price.value) < 1) {
      price.classList.add('is-error');
      priceErr.classList.add('show');
      valid = false;
    } else {
      price.classList.remove('is-error');
      priceErr.classList.remove('show');
    }

    const loc    = document.getElementById('prod-location');
    const locErr = document.getElementById('prod-location-error');
    if (!loc.value.trim()) {
      loc.classList.add('is-error');
      locErr.classList.add('show');
      valid = false;
    } else {
      loc.classList.remove('is-error');
      locErr.classList.remove('show');
    }

    const qtyEl  = document.getElementById('prod-qty');
    const qtyErr = document.getElementById('prod-qty-error');
    if (qtyEl) {
      if (qtyEl.value === '' || parseInt(qtyEl.value) < 0) {
        qtyEl.classList.add('is-error');
        qtyErr.classList.add('show');
        valid = false;
      } else {
        qtyEl.classList.remove('is-error');
        qtyErr.classList.remove('show');
      }
    }

    const img    = document.getElementById('prod-img');
    const imgErr = document.getElementById('prod-img-error');
    if (img.value.trim() && !isValidUrl(img.value.trim())) {
      img.classList.add('is-error');
      imgErr.classList.add('show');
      valid = false;
    } else {
      img.classList.remove('is-error');
      imgErr.classList.remove('show');
    }

    return valid;
  }

  // ──────────────────────────────────────────────────────────
  //  CLEAR FORM
  // ──────────────────────────────────────────────────────────
  function initClearForm() {
    const btn = document.getElementById('clear-form-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      document.getElementById('add-product-form').reset();
      const box = document.getElementById('commission-box');
      if (box) box.classList.remove('show');
      clearAlert('add-alert');
      document.querySelectorAll('#add-product-form .form-input').forEach(el => el.classList.remove('is-error'));
      document.querySelectorAll('#add-product-form .error-msg').forEach(el => el.classList.remove('show'));
    });
  }

  // ──────────────────────────────────────────────────────────
  //  SEARCH + LOCATION FILTER
  // ──────────────────────────────────────────────────────────
  function initSearchAndFilter() {
    const searchInput    = document.getElementById('search-input');
    const locationSelect = document.getElementById('location-filter');

    if (searchInput)    searchInput.addEventListener('input', applySearchAndFilter);
    if (locationSelect) locationSelect.addEventListener('change', applySearchAndFilter);
  }

  function applySearchAndFilter() {
    const q   = (document.getElementById('search-input')?.value || '').trim().toLowerCase();
    const loc = (document.getElementById('location-filter')?.value || '').toLowerCase();

    let filtered = _allProducts;

    if (q) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.location || '').toLowerCase().includes(q)
      );
    }

    if (loc) {
      filtered = filtered.filter(p =>
        (p.location || '').toLowerCase() === loc
      );
    }

    renderShopGrid(filtered);
    const countLabel = document.getElementById('products-count');
    if (countLabel) countLabel.textContent = `${filtered.length} product${filtered.length !== 1 ? 's' : ''}`;
    updateStats(filtered);
  }

  /** Populate the location filter dropdown with unique cities */
  function updateLocationFilter(products) {
    const select = document.getElementById('location-filter');
    if (!select) return;

    const current = select.value;
    const cities  = [...new Set(
      products
        .map(p => (p.location || '').trim())
        .filter(Boolean)
        .map(c => c.charAt(0).toUpperCase() + c.slice(1).toLowerCase())
    )].sort();

    select.innerHTML = '<option value="">All Cities</option>';
    cities.forEach(city => {
      const opt = document.createElement('option');
      opt.value = city.toLowerCase();
      opt.textContent = city;
      if (opt.value === current) opt.selected = true;
      select.appendChild(opt);
    });
  }

  // ──────────────────────────────────────────────────────────
  //  STATS
  // ──────────────────────────────────────────────────────────
  function updateStats(products) {
    const total   = products.length;
    const premium = products.filter(p => p.isPremium).length;
    const cities  = new Set(products.map(p => (p.location || '').toLowerCase())).size;
    const avgFinal = total
      ? Math.round(products.reduce((sum, p) => sum + (p.finalPrice || 0), 0) / total)
      : 0;

    if (document.getElementById('stat-total'))   document.getElementById('stat-total').textContent   = total;
    if (document.getElementById('stat-avg'))      document.getElementById('stat-avg').textContent      = formatINR(avgFinal);
    if (document.getElementById('stat-premium'))  document.getElementById('stat-premium').textContent  = premium;
    if (document.getElementById('stat-cities'))   document.getElementById('stat-cities').textContent   = cities;
  }

  // ──────────────────────────────────────────────────────────
  //  MODAL — Buy Now
  // ──────────────────────────────────────────────────────────
  function initModal() {
    const overlay  = document.getElementById('modal-overlay');
    const closeBtn = document.getElementById('modal-close');
    const buyBtn   = document.getElementById('modal-buy-btn');

    if (!overlay) return;

    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

    if (buyBtn) {
      buyBtn.addEventListener('click', async () => {
        const productId = buyBtn.dataset.productId;
        if (!productId) return;

        const p = _allProducts.find(x => x.id === productId);
        if (!p) return;

        const qty = typeof p.quantity !== 'undefined' ? parseInt(p.quantity) : null;
        if (qty !== null && qty <= 0) {
          showToast('This product is out of stock.', 'error');
          return;
        }

        // Decrement quantity in Firestore
        if (qty !== null) {
          try {
            const newQty = qty - 1;
            await db.collection('products').doc(productId).update({
              quantity: newQty,
              inStock:  newQty > 0
            });
          } catch (err) {
            showToast('Could not update stock: ' + err.message, 'error');
            return;
          }
        }

        showToast('Order placed! (Demo mode — no real payment)', 'success');
        closeModal();
      });
    }
  }

  function openModal(product) {
    const overlay = document.getElementById('modal-overlay');
    if (!overlay) return;

    const { final } = calcCommission(product.sellerPrice);
    const qty       = typeof product.quantity !== 'undefined' ? parseInt(product.quantity) : null;
    const outOfStock = qty !== null && qty <= 0;

    document.getElementById('modal-name').textContent     = product.name;
    document.getElementById('modal-location').textContent = '📍 ' + product.location;
    document.getElementById('modal-price').textContent    = formatINR(final);

    // Qty info in modal
    const qtyInfo = document.getElementById('modal-qty-info');
    if (qtyInfo) {
      if (qty !== null) {
        qtyInfo.innerHTML = outOfStock
          ? `<span class="qty-badge out-of-stock" style="display:inline-block;margin-bottom:0.4rem;">Out of Stock</span>`
          : `<span class="qty-badge in-stock" style="display:inline-block;margin-bottom:0.4rem;">Available: ${qty}</span>`;
      } else {
        qtyInfo.innerHTML = '';
      }
    }

    // Buy Now button state
    const buyBtn = document.getElementById('modal-buy-btn');
    if (buyBtn) {
      buyBtn.dataset.productId = product.id;
      if (outOfStock) {
        buyBtn.textContent = 'Out of Stock';
        buyBtn.disabled    = true;
        buyBtn.classList.add('btn-disabled');
      } else {
        buyBtn.textContent = 'Buy Now';
        buyBtn.disabled    = false;
        buyBtn.classList.remove('btn-disabled');
      }
    }

    const imgWrap = document.querySelector('.modal-img-wrap');
    const img     = document.getElementById('modal-img');

    if (product.imageUrl) {
      img.src           = product.imageUrl;
      img.style.display = 'block';
      img.onerror = () => {
        img.style.display = 'none';
        if (imgWrap) imgWrap.style.background = '#f5f5f5';
      };
    } else {
      img.style.display = 'none';
    }

    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.add('hidden');
    document.body.style.overflow = '';
  }

} // end IS_DASHBOARD

// ──────────────────────────────────────────────────────────
//  GLOBAL showToast (used by inline onclick too)
// ──────────────────────────────────────────────────────────
window.showToast = showToast;
