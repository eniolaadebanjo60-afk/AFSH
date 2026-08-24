const SUPABASE_URL = 'https://uvabqyxnongkfkhcebvo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_z9EV9DyjhjWvZb_Dg140jA_chP4CGhS';

async function getAuthToken() {
  if (typeof supabaseClient !== 'undefined') {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    if (sessionData.session) {
      return sessionData.session.access_token;
    }
  }
  return SUPABASE_KEY;
}

async function supabaseFetch(table, filters = '') {
  const token = await getAuthToken();
  const url = `${SUPABASE_URL}/rest/v1/${table}?${filters}`;
  const response = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok) throw new Error(`Failed to fetch ${table}`);
  return response.json();
}

async function supabaseInsert(table, data, returnData = true) {
  const token = await getAuthToken();
  const url = `${SUPABASE_URL}/rest/v1/${table}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': returnData ? 'return=representation' : 'return=minimal'
    },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error(`Failed to insert into ${table}`);
  return returnData ? response.json() : true;
}

async function supabaseUpdate(table, id, data) {
  const token = await getAuthToken();
  const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify(data)
  });
  if (!response.ok) throw new Error(`Failed to update ${table}`);
  return response.json();
}

async function supabaseDelete(table, id) {
  const token = await getAuthToken();
  const url = `${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok) throw new Error(`Failed to delete from ${table}`);
  return true;
}

async function loadJobs() {
  const container = document.getElementById('jobsList');
  const noMsg     = document.getElementById('noJobsMsg');

  if (!container) return;

  container.innerHTML = `
    <div style="text-align:center; padding:40px; color:#5A5A5A;">
      <i class="fa-solid fa-spinner fa-spin" style="font-size:24px; color:#F5900A;"></i>
      <p style="margin-top:12px;">Loading opportunities...</p>
    </div>
  `;

  try {
    const jobs = await supabaseFetch('JOBS', 'is_active=eq.true&order=display_order.asc');

    if (!jobs || jobs.length === 0) {
      container.innerHTML = '';
      if (noMsg) noMsg.style.display = 'block';
      return;
    }

    if (noMsg) noMsg.style.display = 'none';

    container.innerHTML = jobs.map((job, idx) => {
      const badgeClass = job.type === 'Full-Time' ? 'badge-full' : 'badge-contract';
      let responsibilities = [];
      let requirements = [];
      try {
        responsibilities = JSON.parse(job.responsibilities);
        requirements     = JSON.parse(job.requirements);
      } catch {
        responsibilities = [job.responsibilities];
        requirements     = [job.requirements];
      }

      return `
        <div class="job-card" id="job-${idx}">
          <div class="job-header" onclick="toggleJob(${idx})">
            <div class="job-left">
              <div class="job-title">${job.title}</div>
              <p class="job-about">${job.about}</p>
              <div class="job-purpose-label">Job Purpose</div>
              <p class="job-summary">${job.summary}</p>
              <div class="job-meta">
                <div class="job-meta-item">
                  <i class="fa-solid fa-location-dot"></i> ${job.location}
                </div>
                <div class="job-meta-item">
                  <i class="fa-solid fa-calendar-days"></i> Deadline: ${job.deadline}
                </div>
                <span class="job-badge ${badgeClass}">${job.type}</span>
              </div>
            </div>
            <div class="job-toggle-icon" id="icon-${idx}">
              <i class="fa-solid fa-chevron-down"></i>
            </div>
          </div>

          <div class="job-dropdown" id="dropdown-${idx}">
            <div class="job-desc-inner">
              <div class="job-desc-block">
                <h4>Roles &amp; Responsibilities</h4>
                <ul>${responsibilities.map(r => `<li>${r}</li>`).join('')}</ul>
              </div>
              <div class="job-desc-block">
                <h4>Requirements</h4>
                <ul>${requirements.map(r => `<li>${r}</li>`).join('')}</ul>
              </div>
              <div class="job-desc-block how-to-apply">
                <h4>How to Apply</h4>
                <p>${job.how_to_apply}</p>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

  } catch (error) {
    console.error('Error loading jobs:', error);
    container.innerHTML = `
      <div style="text-align:center; padding:40px; color:#5A5A5A;">
        <p>Unable to load job listings. Please try again later.</p>
      </div>
    `;
  }
}

async function loadBlogPosts() {
  const grid     = document.getElementById('blogGrid');
  const featured = document.getElementById('featuredPost');

  if (!grid) return;

  grid.innerHTML = `
    <div style="text-align:center; padding:40px; color:#5A5A5A; grid-column:1/-1;">
      <i class="fa-solid fa-spinner fa-spin" style="font-size:24px; color:#F5900A;"></i>
      <p style="margin-top:12px;">Loading posts...</p>
    </div>
  `;

  try {
    const posts = await supabaseFetch('Posts', 'is_published=eq.true&order=published_at.desc');

    if (!posts || posts.length === 0) {
      grid.innerHTML = '<p style="text-align:center; color:#5A5A5A; grid-column:1/-1;">No posts yet. Check back soon.</p>';
      return;
    }

    const featuredPost = posts.find(p => p.is_featured) || posts[0];
    const regularPosts = posts.filter(p => p.id !== featuredPost.id);

    if (featured && featuredPost) {
      featured.innerHTML = `
        <a href="blog-post.html?id=${featuredPost.id}" class="featured-card">
          <div class="featured-image">
            <img src="${featuredPost.featured_image_url}" alt="${featuredPost.title}"/>
            <div class="featured-badge">Featured</div>
          </div>
          <div class="featured-content">
            <div class="post-meta">
              <span class="post-category">${featuredPost.category}</span>
              <span class="post-date"><i class="fa-regular fa-calendar"></i> ${featuredPost.published_at ? new Date(featuredPost.published_at).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }) : ''}</span>
              ${featuredPost.read_time ? `<span class="post-read"><i class="fa-regular fa-clock"></i> ${featuredPost.read_time}</span>` : ''}
            </div>
            <h2>${featuredPost.title}</h2>
            <p>${featuredPost.excerpt}</p>
            <span class="post-link">Read Full Article <i class="fa-solid fa-arrow-right"></i></span>
          </div>
        </a>
      `;
    }

    grid.innerHTML = regularPosts.map(post => `
      <a href="blog-post.html?id=${post.id}" class="blog-card">
        <div class="blog-card-img">
          <img src="${post.featured_image_url}" alt="${post.title}"/>
          <span class="card-category">${post.category}</span>
        </div>
        <div class="blog-card-body">
          <div class="post-meta">
            <span class="post-date"><i class="fa-regular fa-calendar"></i> ${post.published_at ? new Date(post.published_at).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' }) : ''}</span>
            ${post.read_time ? `<span class="post-read"><i class="fa-regular fa-clock"></i> ${post.read_time}</span>` : ''}
          </div>
          <h3>${post.title}</h3>
          <p>${post.excerpt}</p>
          <span class="post-link">Read More <i class="fa-solid fa-arrow-right"></i></span>
        </div>
      </a>
    `).join('');

  } catch (error) {
    console.error('Error loading posts:', error);
    grid.innerHTML = '<p style="text-align:center; color:#5A5A5A; grid-column:1/-1;">Unable to load posts. Please try again later.</p>';
  }
}

async function loadSinglePost() {
  const params = new URLSearchParams(window.location.search);
  const id     = params.get('id');

  if (!id) return;

  try {
    const posts = await supabaseFetch('Posts', `id=eq.${id}&is_published=eq.true`);
    const post  = posts[0];

    if (!post) return;

    // Update page title
    document.title = `${post.title} – AFSH Blog`;

    const heroTitle = document.getElementById('postTitle');
    if (heroTitle) heroTitle.textContent = post.title;

    const heroCategory = document.getElementById('postCategory');
    if (heroCategory) heroCategory.textContent = post.category;

    const heroDate = document.getElementById('postDate');
    if (heroDate && post.published_at) {
      heroDate.textContent = new Date(post.published_at).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
    }

    const featImg = document.getElementById('postFeaturedImage');
    if (featImg) {
      featImg.src = post.featured_image_url;
      featImg.alt = post.title;
    }

    const bodyEl = document.getElementById('postBody');
    if (bodyEl) {
      bodyEl.innerHTML = post.body;
    }

  } catch (error) {
    console.error('Error loading post:', error);
  }
}

async function loadTestimonials() {
  const track = document.getElementById('testimonialsTrack');
  if (!track) return;

  try {
    const testimonials = await supabaseFetch('Testimonials', 'is_active=eq.true');

    if (!testimonials || testimonials.length === 0) return;

    track.innerHTML = testimonials.map(t => `
      <div class="testimonial-card">
        <div class="testimonial-quote"><i class="fa-solid fa-quote-left"></i></div>
        <p>"${t.quote}"</p>
        <div class="testimonial-author">
          <div class="author-avatar">${t.name.split(' ').map(n => n[0]).join('').slice(0,2)}</div>
          <div>
            <strong>${t.name}</strong>
            <span>${t.location}</span>
          </div>
        </div>
      </div>
    `).join('');

    const tDotsContainer = document.getElementById('tDots');
    if (tDotsContainer) {
      tDotsContainer.innerHTML = '';
      testimonials.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.className = 'slider-dot' + (i === 0 ? ' active' : '');
        dot.addEventListener('click', () => goToTestimonial(i));
        tDotsContainer.appendChild(dot);
      });
    }

  } catch (error) {
    console.error('Error loading testimonials:', error);
  }
}

async function submitContactForm(formData) {
  try {
    await supabaseInsert('Messages', {
      first_name: formData.firstName,
      last_name:  formData.lastName,
      email:      formData.email,
      phone:      formData.phone,
      subject:    formData.subject,
      message:    formData.message,
      is_read:    false
    }, false);
    return { success: true };
  } catch (error) {
    console.error('Error submitting form:', error);
    return { success: false };
  }
}