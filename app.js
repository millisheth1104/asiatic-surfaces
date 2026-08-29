/* ======================================
   360° Virtual Tour — Application Logic
   ====================================== */

(function () {
    'use strict';

    // ---- State ----
    let viewer = null;
    let isAutoRotating = false;
    let hasInteracted = false;
    let isGyroActive = false;
    let gyroPermissionGranted = false;
    let initialAlpha = null; // capture initial heading offset

    // ---- DOM References ----
    const loadingScreen = document.getElementById('loading-screen');
    const loaderBarFill = document.getElementById('loader-bar-fill');
    const appContainer = document.getElementById('app-container');
    const compassNeedle = document.getElementById('compass-needle');
    const btnZoomIn = document.getElementById('btn-zoom-in');
    const btnZoomOut = document.getElementById('btn-zoom-out');
    const btnAutoRotate = document.getElementById('btn-auto-rotate');
    const btnReset = document.getElementById('btn-reset');
    const btnFullscreen = document.getElementById('btn-fullscreen');
    const fullscreenIcon = document.getElementById('fullscreen-icon');
    const exitFullscreenIcon = document.getElementById('exit-fullscreen-icon');
    const fovValue = document.getElementById('fov-value');
    const directionValue = document.getElementById('direction-value');
    const dragHint = document.getElementById('drag-hint');
    const btnGyro = document.getElementById('btn-gyro');
    const gyroModal = document.getElementById('gyro-modal');
    const gyroModalCancel = document.getElementById('gyro-modal-cancel');
    const gyroModalAllow = document.getElementById('gyro-modal-allow');
    const btnFullsheet = document.getElementById('btn-fullsheet');
    const fullsheetOverlay = document.getElementById('fullsheet-overlay');
    const fullsheetClose = document.getElementById('fullsheet-close');
    const fullsheetImage = document.getElementById('fullsheet-image');
    const fullsheetImageContainer = document.getElementById('fullsheet-image-container');
    const fullsheetZoomIn = document.getElementById('fullsheet-zoom-in');
    const fullsheetZoomOut = document.getElementById('fullsheet-zoom-out');
    const fullsheetZoomReset = document.getElementById('fullsheet-zoom-reset');
    const fullsheetZoomIndicator = document.getElementById('fullsheet-zoom-indicator');

    // ---- Loading Simulation ----
    function simulateLoading() {
        return new Promise((resolve) => {
            let progress = 0;
            const interval = setInterval(() => {
                // Accelerate toward end
                const increment = progress < 70 ? Math.random() * 15 + 5 : Math.random() * 8 + 2;
                progress = Math.min(progress + increment, 100);
                loaderBarFill.style.width = progress + '%';

                if (progress >= 100) {
                    clearInterval(interval);
                    setTimeout(resolve, 300);
                }
            }, 150);
        });
    }

    // ---- Real-Time Product Hotspots Sync ----
    function get3DProductHotspots() {
        if (window.ProductCatalog && typeof window.ProductCatalog.getProducts === 'function') {
            const allProducts = window.ProductCatalog.getProducts();
            // Filter products that have 3D image enabled
            return allProducts.filter(p => p.threeD);
        }
        return [{ code: '#4006', name: '#4006', pitch: 23, yaw: 0, fullsheet: true }];
    }

    // Creates the floating product label DOM element for a hotspot
    function createProductTooltip(hotspotDiv, productData) {
        const wrapper = document.createElement('div');
        wrapper.className = 'product-label';
        wrapper.style.cursor = 'pointer';

        const dot = document.createElement('span');
        dot.className = 'product-label-dot';

        const text = document.createElement('span');
        text.className = 'product-label-text';
        text.textContent = productData.code || productData.name || '#Product';

        wrapper.appendChild(dot);
        wrapper.appendChild(text);
        hotspotDiv.appendChild(wrapper);

        // Click hotspot to view product fullsheet or catalog
        wrapper.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (productData.fullsheet) {
                // Set the dynamic fullsheet texture image source
                if (fullsheetImage) {
                    let fsSrc = 'src/Fullsheet/Fullsheet1.jpeg';
                    if (productData.fullsheetUrl) {
                        if (productData.fullsheetUrl.startsWith('db:')) {
                            const dbKey = productData.fullsheetUrl.replace('db:', '');
                            if (window.ProductCatalog && typeof window.ProductCatalog.getAsset === 'function') {
                                const storedData = await window.ProductCatalog.getAsset(dbKey);
                                if (storedData) fsSrc = storedData;
                            }
                        } else {
                            fsSrc = productData.fullsheetUrl;
                        }
                    }
                    fullsheetImage.src = fsSrc;
                }
                const titleArea = document.querySelector('.fullsheet-title-area span');
                if (titleArea) {
                    titleArea.textContent = `${productData.code} - ${productData.name} Fullsheet`;
                }
                // Trigger fullsheet overlay if fullsheet is available
                if (btnFullsheet) btnFullsheet.click();
            } else {
                window.location.href = 'products.html?code=' + encodeURIComponent(productData.code);
            }
        });
    }

    // ---- Initialize Pannellum ----
    async function initViewer() {
        // Pull latest cloud products so newly uploaded 3D panoramas are available
        if (window.ProductCatalog && typeof window.ProductCatalog.syncFromCloud === 'function') {
            try {
                await window.ProductCatalog.syncFromCloud();
            } catch (e) { }
        }

        const products3D = window.ProductCatalog && typeof window.ProductCatalog.getProducts === 'function' ? window.ProductCatalog.getProducts() : [];
        
        // Retrieve target category and code from path /categoryName/codeNumber or /tour/[slug] or ?code=
        let targetCategory = null;
        let targetCode = null;
        const pathSegments = window.location.pathname.split('/').filter(Boolean);

        if (pathSegments.length >= 2) {
            // e.g. /fabric/4011 or /laminates/4006
            targetCategory = decodeURIComponent(pathSegments[0]).toLowerCase().replace(/-/g, ' ');
            targetCode = decodeURIComponent(pathSegments[1]).replace('.html', '');
        } else {
            const urlParams = new URLSearchParams(window.location.search);
            targetCategory = urlParams.get('cat') || urlParams.get('category') || urlParams.get('type');
            targetCode = urlParams.get('code') || urlParams.get('id') || urlParams.get('slug');
        }
        
        let panoramaSrc = null;
        let initialPitch = 23;
        let initialYaw = 0;
        let matched = null;

        if (targetCode) {
            const cleanParam = targetCode.toLowerCase().replace(/#/g, '').trim();
            const cleanCatParam = targetCategory ? targetCategory.toLowerCase().replace(/\s+/g, '').replace(/-/g, '') : null;

            // 1. Match both code and category if category provided
            if (cleanCatParam) {
                matched = products3D.find(p => {
                    const cleanProductCode = (p.code || '').toLowerCase().replace(/#/g, '').trim();
                    const cleanSlug = (p.slug || '').toLowerCase().trim();
                    const cleanId = (p.id || '').toLowerCase().trim();
                    const cleanProductCat = (p.category || '').toLowerCase().replace(/\s+/g, '').replace(/-/g, '');
                    const codeMatches = cleanParam === cleanProductCode || cleanParam === cleanSlug || cleanParam === cleanId;
                    return codeMatches && cleanProductCat === cleanCatParam;
                });
            }

            // 2. Fallback to matching code directly
            if (!matched) {
                matched = products3D.find(p => {
                    const cleanProductCode = (p.code || '').toLowerCase().replace(/#/g, '').trim();
                    const cleanSlug = (p.slug || '').toLowerCase().trim();
                    const cleanId = (p.id || '').toLowerCase().trim();
                    return cleanParam === cleanProductCode || cleanParam === cleanSlug || cleanParam === cleanId;
                });
            }

            if (matched) {
                const subEl = document.getElementById('header-subtitle');
                if (subEl && matched.name) subEl.textContent = (matched.name || 'Room Interior').toUpperCase();

                const roomNameEl = document.getElementById('room-name');
                if (roomNameEl) roomNameEl.textContent = `${matched.category || ''} ${matched.code || ''}`.trim() || 'Living Space';

                let matchedPanoSrc = null;
                if (matched.threeDDataUrl) {
                    if (matched.threeDDataUrl.startsWith('db:')) {
                        const dbKey = matched.threeDDataUrl.replace('db:', '');
                        if (window.ProductCatalog && typeof window.ProductCatalog.getAsset === 'function') {
                            matchedPanoSrc = await window.ProductCatalog.getAsset(dbKey);
                        }
                    } else if (matched.threeDDataUrl.startsWith('data:') || matched.threeDDataUrl.startsWith('http://') || matched.threeDDataUrl.startsWith('https://') || matched.threeDDataUrl.startsWith('src/')) {
                        matchedPanoSrc = matched.threeDDataUrl;
                    }
                }

                if (matchedPanoSrc) {
                    panoramaSrc = matchedPanoSrc;
                }
                
                // Parse optional query override parameters (?pitch=20&yaw=-12)
                const urlParams = new URLSearchParams(window.location.search);
                const queryPitch = urlParams.get('pitch');
                const queryYaw = urlParams.get('yaw');

                initialPitch = queryPitch !== null ? parseFloat(queryPitch) : (typeof matched.pitch === 'number' ? matched.pitch : 23);
                initialYaw = queryYaw !== null ? parseFloat(queryYaw) : (typeof matched.yaw === 'number' ? matched.yaw : 0);
            }
        }

        function hidePreloader() {
            if (loadingScreen) {
                loadingScreen.classList.add('hidden');
                loadingScreen.style.opacity = '0';
                loadingScreen.style.pointerEvents = 'none';
                setTimeout(() => {
                    if (loadingScreen) {
                        loadingScreen.style.display = 'none';
                        loadingScreen.style.visibility = 'hidden';
                    }
                }, 400);
            }
            if (appContainer) {
                appContainer.classList.add('visible');
                appContainer.style.opacity = '1';
                appContainer.style.display = 'block';
            }
        }

        if (!panoramaSrc) {
            hidePreloader();
            const viewerEl = document.getElementById('panorama-viewer');
            if (viewerEl) {
                viewerEl.innerHTML = `
                    <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0c0a09; color: #fff; text-align: center; padding: 24px; z-index: 1000;">
                        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" style="margin-bottom: 18px;">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                        </svg>
                        <h2 style="font-size: 1.5rem; margin-bottom: 8px; font-weight: 600; letter-spacing: -0.01em;">No 3D Image Available</h2>
                        <p style="font-size: 0.85rem; color: rgba(255,255,255,0.45); max-width: 320px; line-height: 1.45;">No 360° panorama image has been uploaded for this product.</p>
                    </div>
                `;
            }
            return;
        }

        // Build hotspots: Only load specific hotspots for this room if they exist;
        // if none are defined on the tour itself, show NO hotspots (prevent #4006 from auto-appearing on clean tours).
        let hotspots = [];
        if (matched && Array.isArray(matched.hotspots) && matched.hotspots.length > 0) {
            hotspots = matched.hotspots.map((hs, index) => {
                const productMeta = products3D.find(p => p.code.toLowerCase().replace(/#/g, '') === hs.code.toLowerCase().replace(/#/g, '')) || { code: hs.code, name: hs.code };
                return {
                    id: `product-hotspot-${hs.code}-${index}`,
                    pitch: hs.pitch,
                    yaw: hs.yaw,
                    type: 'info',
                    cssClass: 'product-hotspot',
                    createTooltipFunc: createProductTooltip,
                    createTooltipArgs: productMeta
                };
            });
        }

        try {
            viewer = pannellum.viewer('panorama-viewer', {
                type: 'equirectangular',
                panorama: panoramaSrc,
                autoLoad: true,
                showControls: false,
                showFullscreenCtrl: false,
                showZoomCtrl: false,
                compass: false,
                mouseZoom: true,
                keyboardZoom: true,
                draggable: true,
                disableKeyboardCtrl: false,
                friction: 0.15,
                hfov: 100,
                minHfov: 30,
                maxHfov: 120,
                pitch: initialPitch,
                yaw: initialYaw,
                autoRotate: 0,
                autoRotateInactivityDelay: 0,
                preview: '',
                hotSpots: hotspots,
                strings: {
                    loadButtonLabel: '',
                    loadingLabel: ''
                }
            });

            // Listen for load complete
            viewer.on('load', onViewerLoaded);

            // Error fallback: If panorama fails to load, display No 3D Image state cleanly
            viewer.on('error', () => {
                hidePreloader();
                const viewerEl = document.getElementById('panorama-viewer');
                if (viewerEl) {
                    viewerEl.innerHTML = `
                        <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0c0a09; color: #fff; text-align: center; padding: 24px; z-index: 1000;">
                            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" style="margin-bottom: 18px;">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                            </svg>
                            <h2 style="font-size: 1.5rem; margin-bottom: 8px; font-weight: 600; letter-spacing: -0.01em;">No 3D Image Available</h2>
                            <p style="font-size: 0.85rem; color: rgba(255,255,255,0.45); max-width: 320px; line-height: 1.45;">No 360° panorama image could be loaded for this product.</p>
                        </div>
                    `;
                }
            });

            // Safety timeout: Ensure preloader is always dismissed within 3.5s
            setTimeout(hidePreloader, 3500);

            // Update compass & info in real-time
            viewer.on('mousedown', onFirstInteraction);
            viewer.on('touchstart', onFirstInteraction);

            // Continuous update loop for compass and info
            requestAnimationFrame(updateLoop);
        } catch (viewerErr) {
            console.error('Failed to initialize Pannellum viewer:', viewerErr);
            hidePreloader();
        }
    }

    function onViewerLoaded() {
        // Hide loading, show app
        if (loadingScreen) {
            loadingScreen.classList.add('hidden');
            loadingScreen.style.opacity = '0';
            loadingScreen.style.pointerEvents = 'none';
            setTimeout(() => {
                if (loadingScreen) {
                    loadingScreen.style.display = 'none';
                    loadingScreen.style.visibility = 'hidden';
                }
            }, 400);
        }
        if (appContainer) {
            appContainer.classList.add('visible');
            appContainer.style.opacity = '1';
            appContainer.style.display = 'block';
        }

        // Check URL parameters for direct product focusing
        const urlParams = new URLSearchParams(window.location.search);
        const targetCode = urlParams.get('code');
        const targetPitch = parseFloat(urlParams.get('pitch'));
        const targetYaw = parseFloat(urlParams.get('yaw'));

        if (!isNaN(targetPitch) && !isNaN(targetYaw)) {
            setTimeout(() => {
                viewer.lookAt(targetPitch, targetYaw, 90, 1000);
            }, 300);
        } else if (targetCode) {
            const products3D = get3DProductHotspots();
            const matched = products3D.find(p => {
                const cleanParam = targetCode.toLowerCase().replace(/#/g, '');
                const cleanProductCode = p.code.toLowerCase().replace(/#/g, '');
                const cleanSlug = (p.slug || '').toLowerCase();
                return cleanParam === cleanProductCode || cleanParam === cleanSlug || cleanParam === p.id.toLowerCase();
            });
            if (matched && typeof matched.pitch === 'number' && typeof matched.yaw === 'number') {
                setTimeout(() => {
                    viewer.lookAt(matched.pitch, matched.yaw, 90, 1000);
                }, 300);
            }
        }
    }

    function onFirstInteraction() {
        if (hasInteracted) return;
        hasInteracted = true;

        // Hide the drag hint
        if (dragHint) {
            dragHint.classList.add('fade-out');
            setTimeout(() => {
                dragHint.style.display = 'none';
            }, 500);
        }
    }

    // ---- Update Loop ----
    function updateLoop() {
        if (viewer) {
            updateCompass();
            updateInfo();
            syncGyroState();
        }
        requestAnimationFrame(updateLoop);
    }

    function syncGyroState() {
        if (viewer) {
            const internalGyroActive = viewer.isOrientationActive();
            if (isGyroActive && !internalGyroActive) {
                isGyroActive = false;
                btnGyro.classList.remove('active', 'gyro-active');
                showToast('Gyroscope paused by touch interaction');
            }
        }
    }

    function updateCompass() {
        const yaw = viewer.getYaw();
        // Rotate the compass needle opposite to viewer yaw
        compassNeedle.style.transform = `rotate(${-yaw}deg)`;
    }

    function updateInfo() {
        const hfov = viewer.getHfov();
        const yaw = viewer.getYaw();
        const pitch = viewer.getPitch();

        fovValue.textContent = Math.round(hfov) + '°';

        // Normalize yaw to 0-360
        const normalizedYaw = ((yaw % 360) + 360) % 360;
        directionValue.textContent = `${Math.round(normalizedYaw)}° / ${Math.round(pitch)}°`;
    }

    // ---- Controls ----
    function handleZoomIn() {
        if (!viewer) return;
        const current = viewer.getHfov();
        viewer.setHfov(Math.max(current - 10, 30), 300);
        onFirstInteraction();
    }

    function handleZoomOut() {
        if (!viewer) return;
        const current = viewer.getHfov();
        viewer.setHfov(Math.min(current + 10, 120), 300);
        onFirstInteraction();
    }

    function handleAutoRotate() {
        if (!viewer) return;
        isAutoRotating = !isAutoRotating;

        if (isAutoRotating) {
            viewer.startAutoRotate(2); // 2 degrees per second
            btnAutoRotate.classList.add('active');
        } else {
            viewer.stopAutoRotate();
            btnAutoRotate.classList.remove('active');
        }
        onFirstInteraction();
    }

    function handleReset() {
        if (!viewer) return;
        viewer.setYaw(0, 800);
        viewer.setPitch(0, 800);
        viewer.setHfov(100, 800);
        onFirstInteraction();
    }

    function handleFullscreen() {
        const elem = document.getElementById('app-container');

        if (!document.fullscreenElement) {
            if (elem.requestFullscreen) {
                elem.requestFullscreen();
            } else if (elem.webkitRequestFullscreen) {
                elem.webkitRequestFullscreen();
            } else if (elem.msRequestFullscreen) {
                elem.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            }
        }
        onFirstInteraction();
    }

    function updateFullscreenIcon() {
        if (document.fullscreenElement) {
            fullscreenIcon.style.display = 'none';
            exitFullscreenIcon.style.display = 'block';
        } else {
            fullscreenIcon.style.display = 'block';
            exitFullscreenIcon.style.display = 'none';
        }
    }

    // ---- Gyroscope ----
    function showToast(message) {
        // Remove existing toasts
        document.querySelectorAll('.gyro-toast').forEach(t => t.remove());
        const toast = document.createElement('div');
        toast.className = 'gyro-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2800);
    }

    function hasGyroscope() {
        return 'DeviceOrientationEvent' in window;
    }

    function enableGyro() {
        if (!viewer) return;

        // Start native Pannellum device orientation control
        viewer.startOrientation();

        isGyroActive = true;
        btnGyro.classList.add('active', 'gyro-active');
        showToast('📱 Gyroscope enabled — tilt to look around');
        onFirstInteraction();

        // Disable auto-rotate when gyro is on (they conflict)
        if (isAutoRotating) {
            viewer.stopAutoRotate();
            isAutoRotating = false;
            btnAutoRotate.classList.remove('active');
        }
    }

    function disableGyro() {
        if (!viewer) return;

        // Stop native Pannellum device orientation control
        viewer.stopOrientation();

        isGyroActive = false;
        btnGyro.classList.remove('active', 'gyro-active');
        showToast('Gyroscope disabled');
    }

    function showGyroModal() {
        gyroModal.style.display = 'flex';
    }

    function hideGyroModal() {
        gyroModal.style.display = 'none';
    }

    async function requestGyroPermission() {
        // iOS 13+ requires explicit permission request from a user gesture
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const response = await DeviceOrientationEvent.requestPermission();
                if (response === 'granted') {
                    gyroPermissionGranted = true;
                    enableGyro();
                } else {
                    showToast('⚠️ Motion sensor permission denied');
                }
            } catch (err) {
                showToast('⚠️ Could not request motion permission');
                console.warn('Gyro permission error:', err);
            }
        } else {
            // Android / non-iOS — permission is automatic
            gyroPermissionGranted = true;
            enableGyro();
        }
    }

    function handleGyroToggle() {
        if (!hasGyroscope()) {
            showToast('⚠️ Gyroscope not available on this device');
            return;
        }

        if (isGyroActive) {
            disableGyro();
            return;
        }

        // If permission already granted, just enable
        if (gyroPermissionGranted) {
            enableGyro();
            return;
        }

        // On iOS, we need a user gesture → show modal
        if (typeof DeviceOrientationEvent !== 'undefined' &&
            typeof DeviceOrientationEvent.requestPermission === 'function') {
            showGyroModal();
        } else {
            // Android — just enable directly
            requestGyroPermission();
        }
    }

    // Modal button handlers
    gyroModalCancel.addEventListener('click', hideGyroModal);
    gyroModalAllow.addEventListener('click', () => {
        hideGyroModal();
        requestGyroPermission();
    });

    // ---- Fullsheet Viewer ----
    let fullsheetScale = 1;
    let fullsheetMinScale = 0.5;
    let fullsheetMaxScale = 5;
    let fsIsDragging = false;
    let fsDragStartX = 0;
    let fsDragStartY = 0;
    let fsScrollStartX = 0;
    let fsScrollStartY = 0;
    let fsZoomIndicatorTimer = null;

    function openFullsheet() {
        fullsheetScale = 1;
        fullsheetOverlay.style.display = 'flex';
        fullsheetOverlay.classList.remove('closing');
        fullsheetImage.style.transform = 'scale(1)';
        fullsheetImageContainer.classList.remove('zoomed');
        fullsheetImageContainer.scrollTop = 0;
        fullsheetImageContainer.scrollLeft = 0;
        updateFullsheetZoomIndicator();
    }

    function closeFullsheet() {
        fullsheetOverlay.classList.add('closing');
        setTimeout(() => {
            fullsheetOverlay.style.display = 'none';
            fullsheetOverlay.classList.remove('closing');
        }, 250);
    }

    function setFullsheetZoom(newScale) {
        fullsheetScale = Math.max(fullsheetMinScale, Math.min(fullsheetMaxScale, newScale));
        fullsheetImage.style.transform = `scale(${fullsheetScale})`;

        if (fullsheetScale > 1) {
            fullsheetImageContainer.classList.add('zoomed');
        } else {
            fullsheetImageContainer.classList.remove('zoomed');
        }

        updateFullsheetZoomIndicator();
    }

    function updateFullsheetZoomIndicator() {
        fullsheetZoomIndicator.textContent = Math.round(fullsheetScale * 100) + '%';
        fullsheetZoomIndicator.classList.add('visible');

        clearTimeout(fsZoomIndicatorTimer);
        fsZoomIndicatorTimer = setTimeout(() => {
            fullsheetZoomIndicator.classList.remove('visible');
        }, 1500);
    }

    // Mouse drag for panning
    fullsheetImageContainer.addEventListener('mousedown', (e) => {
        fsIsDragging = true;
        fsDragStartX = e.clientX;
        fsDragStartY = e.clientY;
        fsScrollStartX = fullsheetImageContainer.scrollLeft;
        fsScrollStartY = fullsheetImageContainer.scrollTop;
        e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
        if (!fsIsDragging) return;
        const dx = e.clientX - fsDragStartX;
        const dy = e.clientY - fsDragStartY;
        fullsheetImageContainer.scrollLeft = fsScrollStartX - dx;
        fullsheetImageContainer.scrollTop = fsScrollStartY - dy;
    });

    window.addEventListener('mouseup', () => {
        fsIsDragging = false;
    });

    // Touch drag for panning
    fullsheetImageContainer.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            fsIsDragging = true;
            fsDragStartX = e.touches[0].clientX;
            fsDragStartY = e.touches[0].clientY;
            fsScrollStartX = fullsheetImageContainer.scrollLeft;
            fsScrollStartY = fullsheetImageContainer.scrollTop;
        }
    }, { passive: true });

    fullsheetImageContainer.addEventListener('touchmove', (e) => {
        if (!fsIsDragging || e.touches.length !== 1) return;
        const dx = e.touches[0].clientX - fsDragStartX;
        const dy = e.touches[0].clientY - fsDragStartY;
        fullsheetImageContainer.scrollLeft = fsScrollStartX - dx;
        fullsheetImageContainer.scrollTop = fsScrollStartY - dy;
    }, { passive: true });

    fullsheetImageContainer.addEventListener('touchend', () => {
        fsIsDragging = false;
    });

    // Scroll-wheel zoom on image
    fullsheetImageContainer.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.15 : 0.15;
        setFullsheetZoom(fullsheetScale + delta);
    }, { passive: false });

    // Button handlers
    fullsheetZoomIn.addEventListener('click', () => setFullsheetZoom(fullsheetScale + 0.25));
    fullsheetZoomOut.addEventListener('click', () => setFullsheetZoom(fullsheetScale - 0.25));
    fullsheetZoomReset.addEventListener('click', () => {
        setFullsheetZoom(1);
        fullsheetImageContainer.scrollTop = 0;
        fullsheetImageContainer.scrollLeft = 0;
    });
    fullsheetClose.addEventListener('click', closeFullsheet);
    btnFullsheet.addEventListener('click', openFullsheet);

    // ---- Event Listeners ----
    btnZoomIn.addEventListener('click', handleZoomIn);
    btnZoomOut.addEventListener('click', handleZoomOut);
    btnAutoRotate.addEventListener('click', handleAutoRotate);
    btnReset.addEventListener('click', handleReset);
    btnFullscreen.addEventListener('click', handleFullscreen);
    btnGyro.addEventListener('click', handleGyroToggle);
    document.addEventListener('fullscreenchange', updateFullscreenIcon);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Escape closes fullsheet if open
        if (e.key === 'Escape' && fullsheetOverlay.style.display !== 'none') {
            closeFullsheet();
            return;
        }

        // Don't process panorama shortcuts while fullsheet is open
        if (fullsheetOverlay.style.display !== 'none') return;

        switch (e.key) {
            case '+':
            case '=':
                handleZoomIn();
                break;
            case '-':
            case '_':
                handleZoomOut();
                break;
            case 'r':
            case 'R':
                handleAutoRotate();
                break;
            case 'f':
            case 'F':
                handleFullscreen();
                break;
            case '0':
                handleReset();
                break;
        }
    });

    // ---- Boot ----
    async function boot() {
        if (loadingScreen) loadingScreen.style.display = 'flex';
        if (appContainer) appContainer.style.display = 'block';

        await simulateLoading();
        await initViewer();
    }

    // Start on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

})();
