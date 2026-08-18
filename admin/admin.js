
const supabaseClient = supabase.createClient(
  'https://uvabqyxnongkfkhcebvo.supabase.co',
  'sb_publishable_z9EV9DyjhjWvZb_Dg140jA_chP4CGhS'
);

async function adminLogin(email, password) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: email,
    password: password
  });

  if (error) {
    return { success: false, message: 'Invalid email or password.' };
  }

  const userId = data.user.id;

  const { data: roleRow, error: roleError } = await supabaseClient
    .from('admin_roles')
    .select('role, access')
    .eq('user_id', userId)
    .single();

  if (roleError || !roleRow) {
    return { success: false, message: 'No role assigned to this account. Contact IT.' };
  }

  localStorage.setItem('afsh_admin_user', JSON.stringify({
    name:   email.split('@')[0],
    role:   roleRow.role,
    access: roleRow.access,
    email:  email
  }));

  return { success: true };
}

async function adminLogout() {
  await supabaseClient.auth.signOut();
  localStorage.removeItem('afsh_admin_user');
  window.location.href = 'index.html';
}

function initDashboard() {
  var user = JSON.parse(localStorage.getItem('afsh_admin_user'));
  if (!user) return;

  var allSections = ['jobs','posts','products','testimonials','messages','settings'];
  allSections.forEach(function(section) {
    var navItem = document.querySelector('[onclick="showSection(\'' + section + '\', this)"]');
    if (navItem && user.access.indexOf(section) === -1) {
      navItem.style.display = 'none';
    }
  });

  var firstSection = user.access[0];
  var firstNav = document.querySelector('[onclick="showSection(\'' + firstSection + '\', this)"]');
  showSection(firstSection, firstNav);

  loadUnreadCount();
}

function showSection(name, el) {
  document.querySelectorAll('.content-section').forEach(function(s) {
    s.classList.remove('active');
  });

  document.querySelectorAll('.nav-item').forEach(function(n) {
    n.classList.remove('active');
  });

  var section = document.getElementById('section-' + name);
  if (section) section.classList.add('active');
  if (el) el.classList.add('active');

  if (name === 'jobs')         loadJobsTable();
  if (name === 'posts')        loadPostsTable();
  if (name === 'products')     loadProductsTable();
  if (name === 'testimonials') loadTestimonialsTable();
  if (name === 'messages')     loadMessagesTable();

  return false;
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

function showSuccess(msg) {
  var el = document.getElementById('successAlert');
  document.getElementById('successMsg').textContent = msg;
  el.style.display = 'flex';
  setTimeout(function() { el.style.display = 'none'; }, 4000);
}

function showError(msg) {
  var el = document.getElementById('errorAlert');
  document.getElementById('errorMsg').textContent = msg;
  el.style.display = 'flex';
  setTimeout(function() { el.style.display = 'none'; }, 4000);
}

function openModal(type, data) {
  document.getElementById('modalOverlay').style.display = 'block';
  document.getElementById('modal').style.display = 'flex';
  document.getElementById('modalTitle').textContent = (data ? 'Edit ' : 'Add ') + typeLabel(type);
  document.getElementById('modalBody').innerHTML = buildForm(type, data);
}

function closeModal() {
  document.getElementById('modalOverlay').style.display = 'none';
  document.getElementById('modal').style.display = 'none';
}

function typeLabel(type) {
  var labels = { job:'Job Role', post:'Blog Post', product:'Product', testimonial:'Testimonial' };
  return labels[type] || type;
}

var deleteCallback = null;

function confirmDelete(callback) {
  document.getElementById('deleteOverlay').style.display = 'block';
  document.getElementById('deleteModal').style.display = 'flex';
  deleteCallback = callback;
  document.getElementById('confirmDeleteBtn').onclick = function() {
    if (deleteCallback) deleteCallback();
    closeDelete();
  };
}

function closeDelete() {
  document.getElementById('deleteOverlay').style.display = 'none';
  document.getElementById('deleteModal').style.display = 'none';
  deleteCallback = null;
}

function statusBadge(isActive) {
  return isActive
    ? '<span class="badge badge-active">Active</span>'
    : '<span class="badge badge-inactive">Inactive</span>';
}

async function loadJobsTable() {
  var tbody = document.getElementById('jobsTableBody');
  tbody.innerHTML = '<tr><td colspan="6" class="loading-row"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</td></tr>';

  try {
    var jobs = await supabaseFetch('JOBS', 'order=display_order.asc');
    if (!jobs || jobs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No job roles yet. Click Add Job Role to create one.</td></tr>';
      return;
    }
    tbody.innerHTML = jobs.map(function(job) {
      return '<tr>' +
        '<td><strong>' + job.title + '</strong></td>' +
        '<td>' + job.location + '</td>' +
        '<td>' + job.type + '</td>' +
        '<td>' + job.deadline + '</td>' +
        '<td>' + statusBadge(job.is_active) + '</td>' +
        '<td class="actions">' +
          '<button class="btn-icon btn-edit" onclick="editJob(' + job.id + ')"><i class="fa-solid fa-pen"></i></button>' +
          '<button class="btn-icon btn-delete" onclick="deleteJob(' + job.id + ')"><i class="fa-solid fa-trash"></i></button>' +
        '</td>' +
      '</tr>';
    }).join('');
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Failed to load jobs.</td></tr>';
  }
}

function buildJobForm(data) {
  var d = data || {};
  return '<form id="jobForm" onsubmit="saveJob(event,' + (d.id || 'null') + ')">' +
    '<div class="form-row">' +
      '<div class="form-group"><label>Job Title *</label><input class="form-input" name="title" value="' + (d.title||'') + '" required/></div>' +
      '<div class="form-group"><label>Location *</label><input class="form-input" name="location" value="' + (d.location||'') + '" required/></div>' +
    '</div>' +
    '<div class="form-row">' +
      '<div class="form-group"><label>Employment Type *</label>' +
        '<select class="form-input" name="type">' +
          '<option value="Full-Time"' + (d.type==='Full-Time'?' selected':'') + '>Full-Time</option>' +
          '<option value="Part-Time"' + (d.type==='Part-Time'?' selected':'') + '>Part-Time</option>' +
          '<option value="Contract"' + (d.type==='Contract'?' selected':'') + '>Contract</option>' +
          '<option value="Internship"' + (d.type==='Internship'?' selected':'') + '>Internship</option>' +
        '</select>' +
      '</div>' +
      '<div class="form-group"><label>Deadline *</label><input class="form-input" name="deadline" value="' + (d.deadline||'') + '" placeholder="e.g. July 30, 2026" required/></div>' +
    '</div>' +
    '<div class="form-group"><label>Contact Email *</label><input class="form-input" type="email" name="contact_email" value="' + (d.contact_email||'') + '" required/></div>' +
    '<div class="form-group"><label>About This Role *</label><textarea class="form-input form-textarea" name="about" required>' + (d.about||'') + '</textarea></div>' +
    '<div class="form-group"><label>Job Purpose / Summary *</label><textarea class="form-input form-textarea" name="summary" required>' + (d.summary||'') + '</textarea></div>' +
    '<div class="form-group"><label>Responsibilities * <small>(one per line)</small></label><textarea class="form-input form-textarea tall" name="responsibilities" placeholder="Monitor incubators daily&#10;Maintain biosecurity standards&#10;Record hatch rates" required>' + (d.responsibilities ? JSON.parse(d.responsibilities).join('\n') : '') + '</textarea></div>' +
    '<div class="form-group"><label>Requirements * <small>(one per line)</small></label><textarea class="form-input form-textarea tall" name="requirements" placeholder="OND/HND in Animal Science&#10;1-2 years experience&#10;Attention to detail" required>' + (d.requirements ? JSON.parse(d.requirements).join('\n') : '') + '</textarea></div>' +
    '<div class="form-group"><label>How to Apply *</label><textarea class="form-input form-textarea" name="how_to_apply" required>' + (d.how_to_apply||'') + '</textarea></div>' +
    '<div class="form-row">' +
      '<div class="form-group"><label>Display Order</label><input class="form-input" type="number" name="display_order" value="' + (d.display_order||1) + '"/></div>' +
      '<div class="form-group"><label>Show on Website</label>' +
        '<select class="form-input" name="is_active">' +
          '<option value="true"' + (d.is_active!==false?' selected':'') + '>Yes — Active</option>' +
          '<option value="false"' + (d.is_active===false?' selected':'') + '>No — Hidden</option>' +
        '</select>' +
      '</div>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>' +
      '<button type="submit" class="btn-primary">Save Job Role</button>' +
    '</div>' +
  '</form>';
}

function buildForm(type, data) {
  if (type === 'job')         return buildJobForm(data);
  if (type === 'post')        return buildPostForm(data);
  if (type === 'product')     return buildProductForm(data);
  if (type === 'testimonial') return buildTestimonialForm(data);
  return '';
}

async function saveJob(e, id) {
  e.preventDefault();
  var form = document.getElementById('jobForm');
  var data = {
    title:          form.title.value,
    location:       form.location.value,
    type:           form.type.value,
    deadline:       form.deadline.value,
    contact_email:  form.contact_email.value,
    about:          form.about.value,
    summary:        form.summary.value,
    responsibilities: JSON.stringify(form.responsibilities.value.split('\n').filter(function(l){ return l.trim(); })),
    requirements:     JSON.stringify(form.requirements.value.split('\n').filter(function(l){ return l.trim(); })),
    how_to_apply:   form.how_to_apply.value,
    display_order:  parseInt(form.display_order.value) || 1,
    is_active:      form.is_active.value === 'true'
  };

  try {
    if (id) {
      await supabaseUpdate('JOBS', id, data);
      showSuccess('Job role updated successfully.');
    } else {
      await supabaseInsert('JOBS', data);
      showSuccess('Job role added successfully.');
    }
    closeModal();
    loadJobsTable();
  } catch(err) {
    showError('Failed to save job role. Please try again.');
  }
}

async function editJob(id) {
  try {
    var jobs = await supabaseFetch('JOBS', 'id=eq.' + id);
    openModal('job', jobs[0]);
  } catch(e) {
    showError('Failed to load job data.');
  }
}

function deleteJob(id) {
  confirmDelete(async function() {
    try {
      await supabaseDelete('JOBS', id);
      showSuccess('Job role deleted.');
      loadJobsTable();
    } catch(e) {
      showError('Failed to delete job role.');
    }
  });
}

async function loadPostsTable() {
  var tbody = document.getElementById('postsTableBody');
  tbody.innerHTML = '<tr><td colspan="6" class="loading-row"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</td></tr>';

  try {
    var posts = await supabaseFetch('Posts', 'order=published_at.desc');
    if (!posts || posts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No blog posts yet.</td></tr>';
      return;
    }
    tbody.innerHTML = posts.map(function(post) {
      var date = post.published_at ? new Date(post.published_at).toLocaleDateString('en-GB') : '-';
      return '<tr>' +
        '<td><strong>' + post.title + '</strong></td>' +
        '<td>' + post.category + '</td>' +
        '<td>' + date + '</td>' +
        '<td>' + (post.is_featured ? '<span class="badge badge-featured">Featured</span>' : '-') + '</td>' +
        '<td>' + statusBadge(post.is_published) + '</td>' +
        '<td class="actions">' +
          '<button class="btn-icon btn-edit" onclick="editPost(' + post.id + ')"><i class="fa-solid fa-pen"></i></button>' +
          '<button class="btn-icon btn-delete" onclick="deletePost(' + post.id + ')"><i class="fa-solid fa-trash"></i></button>' +
        '</td>' +
      '</tr>';
    }).join('');
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Failed to load posts.</td></tr>';
  }
}

function buildPostForm(data) {
  var d = data || {};
  return '<form id="postForm" onsubmit="savePost(event,' + (d.id||'null') + ')">' +
    '<div class="form-group"><label>Post Title *</label><input class="form-input" name="title" value="' + (d.title||'') + '" required/></div>' +
    '<div class="form-row">' +
      '<div class="form-group"><label>Category *</label>' +
        '<select class="form-input" name="category">' +
          ['Farming Tips','Health & Biosecurity','Products','Business','Events','News'].map(function(c) {
            return '<option value="' + c + '"' + (d.category===c?' selected':'') + '>' + c + '</option>';
          }).join('') +
        '</select>' +
      '</div>' +
      '<div class="form-group"><label>Read Time</label><input class="form-input" name="read_time" value="' + (d.read_time||'') + '" placeholder="e.g. 4 min read"/></div>' +
    '</div>' +
    '<div class="form-group"><label>Featured Image URL *</label><input class="form-input" name="featured_image_url" value="' + (d.featured_image_url||'') + '" placeholder="https://..." required/></div>' +
    '<div class="form-group"><label>Excerpt (Short Summary) *</label><textarea class="form-input form-textarea" name="excerpt" required>' + (d.excerpt||'') + '</textarea></div>' +
    '<div class="form-group"><label>Article Body * <small>(HTML supported e.g. &lt;h2&gt;, &lt;p&gt;, &lt;strong&gt;, &lt;ul&gt;&lt;li&gt;)</small></label><textarea class="form-input form-textarea tall" name="body" required>' + (d.body||'') + '</textarea></div>' +
    '<div class="form-row">' +
      '<div class="form-group"><label>Feature this post?</label>' +
        '<select class="form-input" name="is_featured">' +
          '<option value="false"' + (!d.is_featured?' selected':'') + '>No</option>' +
          '<option value="true"' + (d.is_featured?' selected':'') + '>Yes</option>' +
        '</select>' +
      '</div>' +
      '<div class="form-group"><label>Published?</label>' +
        '<select class="form-input" name="is_published">' +
          '<option value="true"' + (d.is_published!==false?' selected':'') + '>Yes — Published</option>' +
          '<option value="false"' + (d.is_published===false?' selected':'') + '>No — Draft</option>' +
        '</select>' +
      '</div>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>' +
      '<button type="submit" class="btn-primary">Save Post</button>' +
    '</div>' +
  '</form>';
}

async function savePost(e, id) {
  e.preventDefault();
  var form = document.getElementById('postForm');
  var title = form.title.value;
  var slug  = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  var data = {
    title:              title,
    slug:               slug,
    category:           form.category.value,
    read_time:          form.read_time.value,
    featured_image_url: form.featured_image_url.value,
    excerpt:            form.excerpt.value,
    body:               form.body.value,
    is_featured:        form.is_featured.value === 'true',
    is_published:       form.is_published.value === 'true',
    published_at:       new Date().toISOString()
  };

  try {
    if (id) {
      await supabaseUpdate('Posts', id, data);
      showSuccess('Blog post updated successfully.');
    } else {
      await supabaseInsert('Posts', data);
      showSuccess('Blog post added successfully.');
    }
    closeModal();
    loadPostsTable();
  } catch(err) {
    showError('Failed to save post. Please try again.');
  }
}

async function editPost(id) {
  try {
    var posts = await supabaseFetch('Posts', 'id=eq.' + id);
    openModal('post', posts[0]);
  } catch(e) {
    showError('Failed to load post data.');
  }
}

function deletePost(id) {
  confirmDelete(async function() {
    try {
      await supabaseDelete('Posts', id);
      showSuccess('Post deleted.');
      loadPostsTable();
    } catch(e) {
      showError('Failed to delete post.');
    }
  });
}

async function loadProductsTable() {
  var tbody = document.getElementById('productsTableBody');
  tbody.innerHTML = '<tr><td colspan="5" class="loading-row"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</td></tr>';

  try {
    var products = await supabaseFetch('Products', 'order=display_order.asc');
    if (!products || products.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="empty-row">No products yet.</td></tr>';
      return;
    }
    tbody.innerHTML = products.map(function(p) {
      return '<tr>' +
        '<td><strong>' + p.name + '</strong></td>' +
        '<td>' + p.tagline + '</td>' +
        '<td>' + p.display_order + '</td>' +
        '<td>' + statusBadge(p.is_active) + '</td>' +
        '<td class="actions">' +
          '<button class="btn-icon btn-edit" onclick="editProduct(' + p.id + ')"><i class="fa-solid fa-pen"></i></button>' +
          '<button class="btn-icon btn-delete" onclick="deleteProduct(' + p.id + ')"><i class="fa-solid fa-trash"></i></button>' +
        '</td>' +
      '</tr>';
    }).join('');
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-row">Failed to load products.</td></tr>';
  }
}

function buildProductForm(data) {
  var d = data || {};
  return '<form id="productForm" onsubmit="saveProduct(event,' + (d.id||'null') + ')">' +
    '<div class="form-row">' +
      '<div class="form-group"><label>Product Name *</label><input class="form-input" name="name" value="' + (d.name||'') + '" required/></div>' +
      '<div class="form-group"><label>Tagline *</label><input class="form-input" name="tagline" value="' + (d.tagline||'') + '" placeholder="e.g. Layer Chicks" required/></div>' +
    '</div>' +
    '<div class="form-group"><label>Image URL *</label><input class="form-input" name="image_url" value="' + (d.image_url||'') + '" placeholder="https://..." required/></div>' +
    '<div class="form-group"><label>Short Description * <small>(for homepage cards)</small></label><textarea class="form-input form-textarea" name="short_description" required>' + (d.short_description||'') + '</textarea></div>' +
    '<div class="form-group"><label>Full Description * <small>(for products page)</small></label><textarea class="form-input form-textarea" name="full_description" required>' + (d.full_description||'') + '</textarea></div>' +
    '<div class="form-group"><label>Key Features * <small>(one per line)</small></label><textarea class="form-input form-textarea" name="features" placeholder="High egg production potential&#10;Early sexual maturity&#10;Excellent feed conversion" required>' + (d.features ? JSON.parse(d.features).join('\n') : '') + '</textarea></div>' +
    '<div class="form-row">' +
      '<div class="form-group"><label>Display Order</label><input class="form-input" type="number" name="display_order" value="' + (d.display_order||1) + '"/></div>' +
      '<div class="form-group"><label>Show on Website</label>' +
        '<select class="form-input" name="is_active">' +
          '<option value="true"' + (d.is_active!==false?' selected':'') + '>Yes — Active</option>' +
          '<option value="false"' + (d.is_active===false?' selected':'') + '>No — Hidden</option>' +
        '</select>' +
      '</div>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>' +
      '<button type="submit" class="btn-primary">Save Product</button>' +
    '</div>' +
  '</form>';
}

async function saveProduct(e, id) {
  e.preventDefault();
  var form = document.getElementById('productForm');
  var data = {
    name:              form.name.value,
    tagline:           form.tagline.value,
    image_url:         form.image_url.value,
    short_description: form.short_description.value,
    full_description:  form.full_description.value,
    features:          JSON.stringify(form.features.value.split('\n').filter(function(l){ return l.trim(); })),
    display_order:     parseInt(form.display_order.value) || 1,
    is_active:         form.is_active.value === 'true'
  };

  try {
    if (id) {
      await supabaseUpdate('Products', id, data);
      showSuccess('Product updated successfully.');
    } else {
      await supabaseInsert('Products', data);
      showSuccess('Product added successfully.');
    }
    closeModal();
    loadProductsTable();
  } catch(err) {
    showError('Failed to save product.');
  }
}

async function editProduct(id) {
  try {
    var products = await supabaseFetch('Products', 'id=eq.' + id);
    openModal('product', products[0]);
  } catch(e) {
    showError('Failed to load product data.');
  }
}

function deleteProduct(id) {
  confirmDelete(async function() {
    try {
      await supabaseDelete('Products', id);
      showSuccess('Product deleted.');
      loadProductsTable();
    } catch(e) {
      showError('Failed to delete product.');
    }
  });
}

async function loadTestimonialsTable() {
  var tbody = document.getElementById('testimonialsTableBody');
  tbody.innerHTML = '<tr><td colspan="6" class="loading-row"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</td></tr>';

  try {
    var testimonials = await supabaseFetch('Testimonials', 'order=display_order.asc');
    if (!testimonials || testimonials.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No testimonials yet.</td></tr>';
      return;
    }
    tbody.innerHTML = testimonials.map(function(t) {
      return '<tr>' +
        '<td><strong>' + t.name + '</strong></td>' +
        '<td>' + t.location + '</td>' +
        '<td class="truncate">' + t.quote.substring(0,60) + '...</td>' +
        '<td>' + t.display_order + '</td>' +
        '<td>' + statusBadge(t.is_active) + '</td>' +
        '<td class="actions">' +
          '<button class="btn-icon btn-edit" onclick="editTestimonial(' + t.id + ')"><i class="fa-solid fa-pen"></i></button>' +
          '<button class="btn-icon btn-delete" onclick="deleteTestimonial(' + t.id + ')"><i class="fa-solid fa-trash"></i></button>' +
        '</td>' +
      '</tr>';
    }).join('');
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Failed to load testimonials.</td></tr>';
  }
}

function buildTestimonialForm(data) {
  var d = data || {};
  return '<form id="testimonialForm" onsubmit="saveTestimonial(event,' + (d.id||'null') + ')">' +
    '<div class="form-row">' +
      '<div class="form-group"><label>Customer Name *</label><input class="form-input" name="name" value="' + (d.name||'') + '" required/></div>' +
      '<div class="form-group"><label>Location *</label><input class="form-input" name="location" value="' + (d.location||'') + '" placeholder="e.g. Poultry Farmer, Kano" required/></div>' +
    '</div>' +
    '<div class="form-group"><label>Quote * <small>(without quotation marks)</small></label><textarea class="form-input form-textarea" name="quote" required>' + (d.quote||'') + '</textarea></div>' +
    '<div class="form-row">' +
      '<div class="form-group"><label>Display Order</label><input class="form-input" type="number" name="display_order" value="' + (d.display_order||1) + '"/></div>' +
      '<div class="form-group"><label>Show on Website</label>' +
        '<select class="form-input" name="is_active">' +
          '<option value="true"' + (d.is_active!==false?' selected':'') + '>Yes — Active</option>' +
          '<option value="false"' + (d.is_active===false?' selected':'') + '>No — Hidden</option>' +
        '</select>' +
      '</div>' +
    '</div>' +
    '<div class="modal-actions">' +
      '<button type="button" class="btn-secondary" onclick="closeModal()">Cancel</button>' +
      '<button type="submit" class="btn-primary">Save Testimonial</button>' +
    '</div>' +
  '</form>';
}

async function saveTestimonial(e, id) {
  e.preventDefault();
  var form = document.getElementById('testimonialForm');
  var data = {
    name:          form.name.value,
    location:      form.location.value,
    quote:         form.quote.value,
    display_order: parseInt(form.display_order.value) || 1,
    is_active:     form.is_active.value === 'true'
  };

  try {
    if (id) {
      await supabaseUpdate('Testimonials', id, data);
      showSuccess('Testimonial updated.');
    } else {
      await supabaseInsert('Testimonials', data);
      showSuccess('Testimonial added.');
    }
    closeModal();
    loadTestimonialsTable();
  } catch(err) {
    showError('Failed to save testimonial.');
  }
}

async function editTestimonial(id) {
  try {
    var items = await supabaseFetch('Testimonials', 'id=eq.' + id);
    openModal('testimonial', items[0]);
  } catch(e) {
    showError('Failed to load testimonial data.');
  }
}

function deleteTestimonial(id) {
  confirmDelete(async function() {
    try {
      await supabaseDelete('Testimonials', id);
      showSuccess('Testimonial deleted.');
      loadTestimonialsTable();
    } catch(e) {
      showError('Failed to delete testimonial.');
    }
  });
}

async function loadMessagesTable() {
  var tbody = document.getElementById('messagesTableBody');
  tbody.innerHTML = '<tr><td colspan="6" class="loading-row"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</td></tr>';

  try {
    var messages = await supabaseFetch('Messages', 'order=created_at.desc');
    if (!messages || messages.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No messages yet.</td></tr>';
      return;
    }
    tbody.innerHTML = messages.map(function(m) {
      var date = m.created_at ? new Date(m.created_at).toLocaleDateString('en-GB') : '-';
      return '<tr class="' + (!m.is_read ? 'unread-row' : '') + '">' +
        '<td><strong>' + m.first_name + ' ' + m.last_name + '</strong></td>' +
        '<td>' + m.email + '</td>' +
        '<td>' + (m.subject||'-') + '</td>' +
        '<td>' + date + '</td>' +
        '<td>' + (m.is_read ? '<span class="badge badge-active">Read</span>' : '<span class="badge badge-inactive">Unread</span>') + '</td>' +
        '<td class="actions">' +
          '<button class="btn-icon btn-edit" onclick="viewMessage(' + m.id + ')" title="View"><i class="fa-solid fa-eye"></i></button>' +
          '<button class="btn-icon btn-delete" onclick="deleteMessage(' + m.id + ')"><i class="fa-solid fa-trash"></i></button>' +
        '</td>' +
      '</tr>';
    }).join('');
  } catch(e) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Failed to load messages.</td></tr>';
  }
}

async function viewMessage(id) {
  try {
    var messages = await supabaseFetch('Messages', 'id=eq.' + id);
    var m = messages[0];
    document.getElementById('modalTitle').textContent = 'Message from ' + m.first_name + ' ' + m.last_name;
    document.getElementById('modalBody').innerHTML =
      '<div class="message-detail">' +
        '<div class="msg-row"><span>Name</span><p>' + m.first_name + ' ' + m.last_name + '</p></div>' +
        '<div class="msg-row"><span>Email</span><p><a href="mailto:' + m.email + '">' + m.email + '</a></p></div>' +
        '<div class="msg-row"><span>Phone</span><p>' + (m.phone||'-') + '</p></div>' +
        '<div class="msg-row"><span>Subject</span><p>' + (m.subject||'-') + '</p></div>' +
        '<div class="msg-row"><span>Message</span><p>' + m.message + '</p></div>' +
        '<div class="modal-actions"><button class="btn-secondary" onclick="closeModal()">Close</button>' +
        '<a href="mailto:' + m.email + '" class="btn-primary"><i class="fa-solid fa-reply"></i> Reply</a></div>' +
      '</div>';
    document.getElementById('modalOverlay').style.display = 'block';
    document.getElementById('modal').style.display = 'flex';
    await supabaseUpdate('Messages', id, { is_read: true });
    loadUnreadCount();
  } catch(e) {
    showError('Failed to load message.');
  }
}

function deleteMessage(id) {
  confirmDelete(async function() {
    try {
      await supabaseDelete('Messages', id);
      showSuccess('Message deleted.');
      loadMessagesTable();
      loadUnreadCount();
    } catch(e) {
      showError('Failed to delete message.');
    }
  });
}

async function loadUnreadCount() {
  try {
    var messages = await supabaseFetch('Messages', 'is_read=eq.false');
    var badge = document.getElementById('msgBadge');
    if (badge) {
      badge.textContent = messages ? messages.length : 0;
      badge.style.display = messages && messages.length > 0 ? 'inline-block' : 'none';
    }
  } catch(e) {}
}