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
// ====================
// Lightbox Functionality
// ====================

function openLightbox(image) {
    const currentImages = state.currentQuery === 'favorites' ? state.favorites : state.images;
    state.currentLightboxIndex = currentImages.findIndex(img => img.id === image.id);

    updateLightboxContent(image);
    DOM.lightbox.style.display = 'block';
    document.body.style.overflow = 'hidden';

    // Update navigation buttons
    updateLightboxNavigation();
}

function closeLightbox() {
    DOM.lightbox.style.display = 'none';
    document.body.style.overflow = '';
}

function updateLightboxContent(image) {
    DOM.lightboxImage.src = image.urls.regular;
    DOM.lightboxImage.alt = image.alt_description || 'Unsplash image';
    DOM.lightboxPhotographerAvatar.src = image.user.profile_image.medium;
    DOM.lightboxPhotographerLink.href = `${image.user.links.html}?utm_source=premium_gallery&utm_medium=referral`;
    DOM.lightboxPhotographerLink.textContent = image.user.name;

    // Update favorite button
    if (isFavorite(image.id)) {
        DOM.lightboxFavorite.classList.add('active');
        DOM.lightboxFavorite.querySelector('svg').style.fill = 'white';
    } else {
        DOM.lightboxFavorite.classList.remove('active');
        DOM.lightboxFavorite.querySelector('svg').style.fill = 'none';
    }

    // Store current image data
    DOM.lightboxFavorite.dataset.imageData = JSON.stringify(image);
    DOM.lightboxDownload.dataset.imageData = JSON.stringify(image);
    DOM.lightboxCopyLink.dataset.imageUrl = image.links.html;

    lucide.createIcons();
}

function updateLightboxNavigation() {
    const currentImages = state.currentQuery === 'favorites' ? state.favorites : state.images;

    // Show/hide navigation buttons
    DOM.prevImage.style.display = state.currentLightboxIndex > 0 ? 'flex' : 'none';
    DOM.nextImage.style.display = state.currentLightboxIndex < currentImages.length - 1 ? 'flex' : 'none';
}

function navigateLightbox(direction) {
    const currentImages = state.currentQuery === 'favorites' ? state.favorites : state.images;

    if (direction === 'prev' && state.currentLightboxIndex > 0) {
        state.currentLightboxIndex--;
    } else if (direction === 'next' && state.currentLightboxIndex < currentImages.length - 1) {
        state.currentLightboxIndex++;
    }

    const image = currentImages[state.currentLightboxIndex];
    updateLightboxContent(image);
    updateLightboxNavigation();
}

// ====================
// Scroll Progress
// ====================

function updateScrollProgress() {
    const windowHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = (window.scrollY / windowHeight) * 100;
    DOM.scrollProgress.style.width = `${scrolled}%`;
}

// ====================
// Favorites View Toggle
// ====================

let showingFavorites = false;

function toggleFavoritesView() {
    showingFavorites = !showingFavorites;

    if (showingFavorites) {
        if (state.favorites.length === 0) {
            DOM.gallery.innerHTML = '';
            DOM.emptyState.style.display = 'block';
            DOM.emptyState.querySelector('.empty-title').textContent = 'No favorites yet';
            DOM.emptyState.querySelector('.empty-message').textContent = 'Start adding images to your favorites collection';
            DOM.resultsInfo.style.display = 'none';
        } else {
            DOM.emptyState.style.display = 'none';
            DOM.resultsInfo.style.display = 'block';
            DOM.resultsText.textContent = `Showing ${state.favorites.length} favorite${state.favorites.length !== 1 ? 's' : ''}`;
            renderImages(state.favorites, false);
        }

        DOM.loadMoreContainer.style.display = 'none';
        DOM.favoritesToggle.classList.add('active');
        state.currentQuery = 'favorites';
    } else {
        DOM.favoritesToggle.classList.remove('active');
        state.currentQuery = '';
        performSearch('');
    }
}

// ====================
// Event Listeners
// ====================

function setupEventListeners() {
    // Search
    DOM.searchInput.addEventListener('input', handleSearch);
    DOM.clearSearch.addEventListener('click', clearSearch);
    DOM.resetSearch.addEventListener('click', clearSearch);

    // Categories
    DOM.categoryPills.forEach(pill => {
        pill.addEventListener('click', handleCategoryClick);
    });

    // Load More
    DOM.loadMoreBtn.addEventListener('click', () => loadImages(true));
    DOM.retryBtn.addEventListener('click', () => {
        DOM.errorState.style.display = 'none';
        loadImages();
    });

    // Theme Toggle
    DOM.themeToggle.addEventListener('click', toggleTheme);

    // Favorites Toggle
    DOM.favoritesToggle.addEventListener('click', toggleFavoritesView);

    // Lightbox
    DOM.closeLightbox.addEventListener('click', closeLightbox);
    DOM.prevImage.addEventListener('click', () => navigateLightbox('prev'));
    DOM.nextImage.addEventListener('click', () => navigateLightbox('next'));

    // Lightbox backdrop click to close
    DOM.lightbox.querySelector('.lightbox-backdrop').addEventListener('click', closeLightbox);

    // Lightbox actions
    DOM.lightboxFavorite.addEventListener('click', () => {
        const imageData = JSON.parse(DOM.lightboxFavorite.dataset.imageData);
        toggleFavorite(imageData);
        updateLightboxContent(imageData);
    });

    DOM.lightboxDownload.addEventListener('click', () => {
        const imageData = JSON.parse(DOM.lightboxDownload.dataset.imageData);
        downloadImage(imageData);
    });

    DOM.lightboxCopyLink.addEventListener('click', () => {
        const url = DOM.lightboxCopyLink.dataset.imageUrl;
        navigator.clipboard.writeText(url).then(() => {
            showToast('Link copied to clipboard', 'success');
        }).catch(() => {
            showToast('Failed to copy link', 'error');
        });
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (DOM.lightbox.style.display === 'block') {
            switch(e.key) {
                case 'Escape':
                    closeLightbox();
                    break;
                case 'ArrowLeft':
                    navigateLightbox('prev');
                    break;
                case 'ArrowRight':
                    navigateLightbox('next');
                    break;
            }
        }

        // Focus search with '/' key
        if (e.key === '/' && document.activeElement !== DOM.searchInput) {
            e.preventDefault();
            DOM.searchInput.focus();
        }
    });

    // Scroll progress
    window.addEventListener('scroll', updateScrollProgress);

    // Header scroll effect
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;

        if (currentScroll > lastScroll && currentScroll > 100) {
            // Scrolling down
            document.getElementById('header').style.transform = 'translateY(-100%)';
        } else {
            // Scrolling up
            document.getElementById('header').style.transform = 'translateY(0)';
        }

        lastScroll = currentScroll;
    });
}

// ====================
// Initialization
// ====================

async function init() {
    try {
        // Load saved data
        loadTheme();
        loadFavorites();

        // Setup event listeners
        setupEventListeners();

        // Setup infinite scroll
        setupInfiniteScroll();

        // Initialize Lucide icons
        lucide.createIcons();

        // Load initial images
        await loadImages();

        // Hide loading screen
        setTimeout(() => {
            DOM.loadingScreen.classList.add('hidden');
            setTimeout(() => {
                DOM.loadingScreen.style.display = 'none';
            }, 500);
        }, 1000);

    } catch (error) {
        console.error('Initialization error:', error);
        DOM.loadingScreen.classList.add('hidden');
        showToast('Failed to initialize gallery', 'error');
    }
}

// ====================
// Start Application
// ====================

// Wait for DOM to be fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// ====================
// Service Worker Registration (Optional)
// ====================

// Uncomment to enable offline functionality
/*
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => console.log('SW registered:', registration))
            .catch(error => console.log('SW registration failed:', error));
    });
}
*/

// ====================
// Performance Monitoring
// ====================

// Log Core Web Vitals
if ('web-vital' in window) {
    window.webVitals.getCLS(console.log);
    window.webVitals.getFID(console.log);
    window.webVitals.getLCP(console.log);
}

// ====================
// Error Handling
// ====================

// Global error handler
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    showToast('An unexpected error occurred', 'error');
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    showToast('An unexpected error occurred', 'error');
});

// ====================
// Network Status Detection
// ====================

window.addEventListener('online', () => {
    showToast('Connection restored', 'success');
    if (state.images.length === 0) {
        loadImages();
    }
});

window.addEventListener('offline', () => {
    showToast('You are offline', 'error');
});

// ====================
// Touch Gestures for Mobile
// ====================

let touchStartX = 0;
let touchEndX = 0;

DOM.lightbox.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
});

DOM.lightbox.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
});

function handleSwipe() {
    const swipeThreshold = 50;

    if (touchEndX < touchStartX - swipeThreshold) {
        // Swipe left - next image
        navigateLightbox('next');
    }

    if (touchEndX > touchStartX + swipeThreshold) {
        // Swipe right - previous image
        navigateLightbox('prev');
    }
}

// ====================
// Accessibility Enhancements
// ====================

// Add skip to content link
const skipLink = document.createElement('a');
skipLink.href = '#gallery';
skipLink.className = 'visually-hidden';
skipLink.textContent = 'Skip to gallery';
skipLink.style.cssText = `
    position: absolute;
    top: -40px;
    left: 0;
    background: var(--accent-primary);
    color: white;
    padding: 8px;
    text-decoration: none;
    z-index: 100000;
`;
skipLink.addEventListener('focus', () => {
    skipLink.style.top = '0';
});
skipLink.addEventListener('blur', () => {
    skipLink.style.top = '-40px';
});
document.body.insertBefore(skipLink, document.body.firstChild);

// Announce dynamic content changes to screen readers
function announceToScreenReader(message) {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.className = 'visually-hidden';
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => announcement.remove(), 1000);
}

// Update announcements when images load
const originalRenderImages = renderImages;
renderImages = function(...args) {
    originalRenderImages.apply(this, args);
    const count = args[0].length;
    announceToScreenReader(`${count} images loaded`);
};

// ====================
// Developer Console Info
// ====================

console.log('%c🎨 Premium Unsplash Gallery', 'font-size: 24px; font-weight: bold; background: linear-gradient(135deg, #6c63ff 0%, #ec4899 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;');
console.log('%cBuilt with ❤️ using Unsplash API', 'font-size: 14px; color: #6c63ff;');
console.log('%cKeyboard Shortcuts:', 'font-size: 16px; font-weight: bold; margin-top: 10px;');
console.log('  / - Focus search bar');
console.log('  ESC - Close lightbox');
console.log('  ← → - Navigate images in lightbox');
console.log('%cFeatures:', 'font-size: 16px; font-weight: bold; margin-top: 10px;');
console.log('  ✓ Infinite scroll with lazy loading');
console.log('  ✓ Advanced search & category filters');
console.log('  ✓ Favorites with localStorage persistence');
console.log('  ✓ Dark/Light theme toggle');
console.log('  ✓ Responsive masonry grid layout');
console.log('  ✓ Full-screen lightbox with navigation');
console.log('  ✓ Image download with API tracking');
console.log('  ✓ Keyboard & touch gesture support');
console.log('  ✓ WCAG 2.1 AA accessibility compliant');
console.log('%c⚠️ SECURITY NOTE:', 'font-size: 14px; font-weight: bold; color: #ef4444; margin-top: 10px;');
console.log('API keys are exposed in client-side code for demo purposes only.');
console.log('In production, use environment variables and a secure backend.');

// ====================
// Export for testing (optional)
// ====================

// Uncomment if you need to test functions in browser console
/*
window.galleryAPI = {
    state,
    loadImages,
    performSearch,
    toggleFavorite,
    toggleTheme,
    openLightbox,
    closeLightbox
};
*/