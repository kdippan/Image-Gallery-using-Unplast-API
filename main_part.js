/* ========================================
   Premium Unsplash Gallery - JavaScript
   ======================================== */

// ====================
// API Configuration
// ====================
// SECURITY NOTE: In production, these credentials should be stored in environment variables
// and accessed through a secure backend API. Never expose API keys in client-side code
// for production applications. This is for demo purposes only.
const API_CONFIG = {
    ACCESS_KEY: 'jgzPJjIoBUjNkAH859_eVYV6u6-W1y57Ui8smY7_f-Y',
    SECRET_KEY: '9iYeipFVx49V7ImlaeAXgQKakSOEO638Xmy8wVaR2Vk', // Not used in client-side requests
    BASE_URL: 'https://api.unsplash.com',
    IMAGES_PER_PAGE: 30
};

// ====================
// Application State
// ====================
const state = {
    images: [],
    favorites: [],
    currentPage: 1,
    currentQuery: '',
    currentCategory: '',
    isLoading: false,
    hasMore: true,
    theme: 'dark',
    currentLightboxIndex: 0
};

// ====================
// DOM Elements
// ====================
const DOM = {
    loadingScreen: document.getElementById('loadingScreen'),
    scrollProgress: document.getElementById('scrollProgress'),
    searchInput: document.getElementById('searchInput'),
    clearSearch: document.getElementById('clearSearch'),
    categoryPills: document.querySelectorAll('.category-pill'),
    gallery: document.getElementById('gallery'),
    loadingIndicator: document.getElementById('loadingIndicator'),
    loadMoreContainer: document.getElementById('loadMoreContainer'),
    loadMoreBtn: document.getElementById('loadMoreBtn'),
    emptyState: document.getElementById('emptyState'),
    errorState: document.getElementById('errorState'),
    errorMessage: document.getElementById('errorMessage'),
    retryBtn: document.getElementById('retryBtn'),
    resetSearch: document.getElementById('resetSearch'),
    resultsInfo: document.getElementById('resultsInfo'),
    resultsText: document.getElementById('resultsText'),
    favoritesToggle: document.getElementById('favoritesToggle'),
    favoritesCount: document.getElementById('favoritesCount'),
    themeToggle: document.getElementById('themeToggle'),
    lightbox: document.getElementById('lightbox'),
    lightboxImage: document.getElementById('lightboxImage'),
    lightboxPhotographerAvatar: document.getElementById('lightboxPhotographerAvatar'),
    lightboxPhotographerLink: document.getElementById('lightboxPhotographerLink'),
    lightboxFavorite: document.getElementById('lightboxFavorite'),
    lightboxCopyLink: document.getElementById('lightboxCopyLink'),
    lightboxDownload: document.getElementById('lightboxDownload'),
    closeLightbox: document.getElementById('closeLightbox'),
    prevImage: document.getElementById('prevImage'),
    nextImage: document.getElementById('nextImage'),
    toastContainer: document.getElementById('toastContainer')
};

// ====================
// Utility Functions
// ====================

// Debounce function to limit API calls
function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

// Local Storage helpers
const storage = {
    get: (key) => {
        try {
            return JSON.parse(localStorage.getItem(key) || '[]');
        } catch (error) {
            console.error('Error reading from localStorage:', error);
            return [];
        }
    },
    set: (key, value) => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error('Error writing to localStorage:', error);
            showToast('Storage quota exceeded', 'error');
        }
    }
};

// Toast notification
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i data-lucide="${type === 'success' ? 'check-circle' : 'alert-circle'}"></i>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <i data-lucide="x"></i>
        </button>
    `;

    DOM.toastContainer.appendChild(toast);
    lucide.createIcons();

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Format number with K/M suffix
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// ====================
// API Functions
// ====================

// Fetch images from Unsplash API
async function fetchImages(query = '', page = 1) {
    try {
        const endpoint = query 
            ? `${API_CONFIG.BASE_URL}/search/photos?query=${encodeURIComponent(query)}&page=${page}&per_page=${API_CONFIG.IMAGES_PER_PAGE}&orientation=portrait`
            : `${API_CONFIG.BASE_URL}/photos?page=${page}&per_page=${API_CONFIG.IMAGES_PER_PAGE}&order_by=popular`;

        const response = await fetch(endpoint, {
            headers: {
                'Authorization': `Client-ID ${API_CONFIG.ACCESS_KEY}`
            }
        });

        if (!response.ok) {
            if (response.status === 403) {
                throw new Error('API rate limit exceeded. Please try again later.');
            }
            throw new Error(`API Error: ${response.status}`);
        }

        const data = await response.json();
        return query ? data.results : data;
    } catch (error) {
        console.error('Error fetching images:', error);
        throw error;
    }
}

// Track download (required by Unsplash API guidelines)
async function trackDownload(downloadLocation) {
    try {
        await fetch(downloadLocation, {
            headers: {
                'Authorization': `Client-ID ${API_CONFIG.ACCESS_KEY}`
            }
        });
    } catch (error) {
        console.error('Error tracking download:', error);
    }
}

// Download image
async function downloadImage(image) {
    try {
        // Track download as per Unsplash API requirements
        if (image.links.download_location) {
            await trackDownload(image.links.download_location);
        }

        // Create download link
        const link = document.createElement('a');
        link.href = image.urls.full;
        link.download = `unsplash-${image.id}.jpg`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        showToast('Download started', 'success');
    } catch (error) {
        console.error('Error downloading image:', error);
        showToast('Download failed', 'error');
    }
}

// ====================
// Favorites Management
// ====================

function loadFavorites() {
    state.favorites = storage.get('unsplash_favorites');
    updateFavoritesCount();
}

function saveFavorites() {
    storage.set('unsplash_favorites', state.favorites);
    updateFavoritesCount();
}

function toggleFavorite(image) {
    const index = state.favorites.findIndex(fav => fav.id === image.id);

    if (index > -1) {
        state.favorites.splice(index, 1);
        showToast('Removed from favorites', 'success');
    } else {
        state.favorites.push(image);
        showToast('Added to favorites', 'success');
    }

    saveFavorites();
    updateFavoriteButtons();
}

function isFavorite(imageId) {
    return state.favorites.some(fav => fav.id === imageId);
}

function updateFavoritesCount() {
    DOM.favoritesCount.textContent = state.favorites.length;
    DOM.favoritesCount.style.display = state.favorites.length > 0 ? 'flex' : 'none';
}

function updateFavoriteButtons() {
    document.querySelectorAll('.favorite-btn').forEach(btn => {
        const imageId = btn.dataset.imageId;
        if (isFavorite(imageId)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

// ====================
// Theme Management
// ====================

function loadTheme() {
    const savedTheme = localStorage.getItem('unsplash_theme') || 'dark';
    state.theme = savedTheme;
    applyTheme(savedTheme);
}

function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    applyTheme(state.theme);
    localStorage.setItem('unsplash_theme', state.theme);
    showToast(`${state.theme === 'dark' ? 'Dark' : 'Light'} mode activated`, 'success');
}

function applyTheme(theme) {
    document.body.className = `${theme}-theme`;
}

// ====================
// Gallery Rendering
// ====================

function createSkeletonCard() {
    const card = document.createElement('div');
    card.className = 'image-card skeleton';
    card.innerHTML = '<div class="image-wrapper"></div>';
    return card;
}

function createImageCard(image) {
    const card = document.createElement('div');
    card.className = 'image-card';
    card.dataset.imageId = image.id;

    const isFav = isFavorite(image.id);

    card.innerHTML = `
        <div class="image-wrapper">
            <img 
                src="${image.urls.small}" 
                alt="${image.alt_description || 'Unsplash image'}"
                loading="lazy"
            >
            <div class="image-overlay">
                <div class="image-info">
                    <div class="photographer-name">${image.user.name}</div>
                    <div class="image-stats">
                        <span>
                            <i data-lucide="heart" style="width: 16px; height: 16px;"></i>
                            ${formatNumber(image.likes)}
                        </span>
                        <span>
                            <i data-lucide="eye" style="width: 16px; height: 16px;"></i>
                            ${formatNumber(image.views || 0)}
                        </span>
                    </div>
                </div>
            </div>
            <button class="favorite-btn ${isFav ? 'active' : ''}" data-image-id="${image.id}">
                <i data-lucide="heart"></i>
            </button>
        </div>
    `;

    // Add click event to open lightbox
    card.querySelector('.image-wrapper').addEventListener('click', (e) => {
        if (!e.target.closest('.favorite-btn')) {
            openLightbox(image);
        }
    });

    // Add favorite button event
    const favoriteBtn = card.querySelector('.favorite-btn');
    favoriteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(image);
    });

    return card;
}

function renderImages(images, append = false) {
    if (!append) {
        DOM.gallery.innerHTML = '';
    }

    images.forEach((image, index) => {
        const card = createImageCard(image);
        // Staggered animation
        card.style.animationDelay = `${index * 0.05}s`;
        DOM.gallery.appendChild(card);
    });

    // Initialize Lucide icons
    lucide.createIcons();
}

function showSkeletons(count = 12) {
    DOM.gallery.innerHTML = '';
    for (let i = 0; i < count; i++) {
        DOM.gallery.appendChild(createSkeletonCard());
    }
}

// ====================
// Search & Filter
// ====================

function performSearch(query, category = '') {
    state.currentQuery = query;
    state.currentCategory = category;
    state.currentPage = 1;
    state.images = [];
    state.hasMore = true;

    loadImages();

    // Update results info
    if (query || category) {
        DOM.resultsInfo.style.display = 'block';
        DOM.resultsText.textContent = `Showing results for "${query || category}"`;
    } else {
        DOM.resultsInfo.style.display = 'none';
    }
}

// Debounced search function
const debouncedSearch = debounce((query) => {
    performSearch(query);
}, 300);

function handleSearch(event) {
    const query = event.target.value.trim();

    // Show/hide clear button
    DOM.clearSearch.style.display = query ? 'block' : 'none';

    // Perform search
    if (query) {
        debouncedSearch(query);
    } else if (state.currentQuery) {
        // Clear search
        performSearch('');
    }
}

function clearSearch() {
    DOM.searchInput.value = '';
    DOM.clearSearch.style.display = 'none';
    performSearch('');
}

function handleCategoryClick(event) {
    const pill = event.currentTarget;
    const category = pill.dataset.category;

    // Update active state
    DOM.categoryPills.forEach(p => p.classList.remove('active'));
    pill.classList.add('active');

    // Clear search input
    DOM.searchInput.value = '';
    DOM.clearSearch.style.display = 'none';

    // Perform search
    performSearch(category);
}

// ====================
// Load Images
// ====================

async function loadImages(append = false) {
    if (state.isLoading || !state.hasMore) return;

    state.isLoading = true;

    // Show appropriate loading state
    if (append) {
        DOM.loadingIndicator.style.display = 'block';
    } else {
        showSkeletons();
        DOM.emptyState.style.display = 'none';
        DOM.errorState.style.display = 'none';
    }

    try {
        const searchTerm = state.currentQuery || state.currentCategory;
        const images = await fetchImages(searchTerm, state.currentPage);

        if (images.length === 0) {
            if (state.currentPage === 1) {
                // No results found
                DOM.gallery.innerHTML = '';
                DOM.emptyState.style.display = 'block';
                state.hasMore = false;
            } else {
                // No more images
                state.hasMore = false;
                DOM.loadMoreContainer.style.display = 'none';
            }
        } else {
            state.images = append ? [...state.images, ...images] : images;
            renderImages(images, append);
            state.currentPage++;

            // Show load more button if there might be more images
            if (images.length === API_CONFIG.IMAGES_PER_PAGE) {
                DOM.loadMoreContainer.style.display = 'block';
            } else {
                state.hasMore = false;
                DOM.loadMoreContainer.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error loading images:', error);
        DOM.gallery.innerHTML = '';
        DOM.errorState.style.display = 'block';
        DOM.errorMessage.textContent = error.message;
    } finally {
        state.isLoading = false;
        DOM.loadingIndicator.style.display = 'none';
    }
}

// ====================
// Infinite Scroll
// ====================

let observer;

function setupInfiniteScroll() {
    const options = {
        root: null,
        rootMargin: '200px',
        threshold: 0.1
    };

    observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !state.isLoading && state.hasMore) {
                loadImages(true);
            }
        });
    }, options);

    observer.observe(DOM.loadMoreContainer);
}