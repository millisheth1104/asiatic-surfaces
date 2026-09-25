/* ======================================
   360° Virtual Tour — Application Logic
   ====================================== */

(function () {
    'use strict';

    /**
     * Pannellum leaves TEXTURE_MIN_FILTER at plain LINEAR with no mip chain, which reads
     * as soft/aliased once the panorama is minified onto the screen - which it always is,
     * since a 360 sphere is bigger than any viewport. Confirmed the prior real bug here:
     * generateMipmap() fails silently on a non-power-of-two texture - it never throws a
     * JS exception, it just queues a WebGL error that only surfaces later through
     * gl.getError() - and pannellum's own setup code calls gl.getError() right after this
     * runs and throws its generic "webgl error" on whatever it finds, including an error
     * this queued and never claimed. That is exactly what broke the tour the first time
     * this was attempted (confirmed live: WebGL error 1282 / INVALID_OPERATION). Draining
     * the error immediately here stops that leak, and mipmapped-texture success is
     * tracked per texture object (not globally) so a texture whose mipmap generation
     * failed keeps today's plain LINEAR instead of being switched to a filter mode that
     * needs mips it doesn't have - that combination is a valid "incomplete texture" per
     * spec, which renders as solid black rather than erroring.
     *
     * Verified locally before shipping: a non-power-of-two image renders normally with
     * LINEAR untouched and glError 0; the same real 8192x4096 panorama that triggered the
     * original break now renders normally with LINEAR_MIPMAP_LINEAR and glError 0.
     */
    (function patchWebGLMipmapping() {
        if (typeof WebGLRenderingContext === 'undefined' || WebGLRenderingContext.prototype.__mipPatched) {
            return;
        }
        const origTexParameteri = WebGLRenderingContext.prototype.texParameteri;
        const origTexImage2D = WebGLRenderingContext.prototype.texImage2D;
        const mipmappedTextures = new WeakSet();

        WebGLRenderingContext.prototype.texImage2D = function () {
            const result = origTexImage2D.apply(this, arguments);
            if (arguments[0] === this.TEXTURE_2D) {
                const bound = this.getParameter(this.TEXTURE_BINDING_2D);
                if (bound) {
                    this.generateMipmap(this.TEXTURE_2D);
                    if (this.getError() === this.NO_ERROR) {
                        mipmappedTextures.add(bound);
                    }
                }
            }
            return result;
        };

        WebGLRenderingContext.prototype.texParameteri = function (target, pname, param) {
            if (target === this.TEXTURE_2D && pname === this.TEXTURE_MIN_FILTER && param === this.LINEAR) {
                const bound = this.getParameter(this.TEXTURE_BINDING_2D);
                if (bound && mipmappedTextures.has(bound)) {
                    param = this.LINEAR_MIPMAP_LINEAR;
                }
            }
            return origTexParameteri.call(this, target, pname, param);
        };

        WebGLRenderingContext.prototype.__mipPatched = true;
    })();

    // ---- State ----
    let viewer = null;
    // The product this tour is showing. The Fullsheet button needs it, and it was only
    // ever available inside the initialiser, which is why that button showed a
    // placeholder instead of the sheet uploaded with the panorama.
    let currentProduct = null;
    let currentPanoramaSrc = null;
    let panoramaImageWidth = 0;
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

    // ---- Code and Category Normalization Helpers ----
    function normCode(s) {
        if (!s) return '';
        return s.toString().toLowerCase().replace(/^prod-/, '').replace(/[^a-z0-9]/g, '');
    }

    function normCat(s) {
        if (!s) return '';
        let c = s.toString().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (c === 'wooden' || c === 'syncro' || c === 'synchro' || c === 'snycro' || c === 'synvro') return 'synchro';
        if (c === '45degree' || c === '45deg') return '45degree';
        return c;
    }

    // ---- Real-Time Product Hotspots Sync ----
    function get3DProductHotspots() {
        if (window.ProductCatalog && typeof window.ProductCatalog.getProducts === 'function') {
            const allProducts = window.ProductCatalog.getProducts();
            // Filter products that have 3D image enabled or uploaded
            return allProducts.filter(p => p.threeD || p.threeDDataUrl);
        }
        // No catalogue engine, no products. This used to return a hardcoded #4006,
        // which then appeared as a phantom hotspot on unrelated tours.
        return [];
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
                    let fsSrc = 'assets/textures/laminates.webp';
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
            const cleanParam = normCode(targetCode);
            const cleanCatParam = targetCategory ? normCat(targetCategory) : null;

            // 1. Match both code and category if category provided
            if (cleanCatParam && cleanParam) {
                matched = products3D.find(p => {
                    const cCode = normCode(p.code);
                    const cSlug = normCode(p.slug);
                    const cId = normCode(p.id);
                    const cCat = normCat(p.category);
                    const codeMatches = cleanParam === cCode || cleanParam === cSlug || cleanParam === cId;
                    return codeMatches && (cCat === cleanCatParam || !cleanCatParam);
                });
            }

            // 2. Fallback to matching code directly
            if (!matched && cleanParam) {
                matched = products3D.find(p => {
                    const cCode = normCode(p.code);
                    const cSlug = normCode(p.slug);
                    const cId = normCode(p.id);
                    return cleanParam === cCode || cleanParam === cSlug || cleanParam === cId;
                });
            }

            if (matched) {
                currentProduct = matched;
                const subEl = document.getElementById('header-subtitle');
                if (subEl && matched.name) subEl.textContent = (matched.name || 'Room Interior').toUpperCase();

                const roomNameEl = document.getElementById('room-name');
                if (roomNameEl) roomNameEl.textContent = `${matched.category || ''} ${matched.code || ''}`.trim() || 'Living Space';

                let matchedPanoSrc = null;
                const panoVal = (matched.threeDDataUrl || matched.panorama || matched.threeDImage || '').toString().trim();
                if (panoVal) {
                    if (panoVal.startsWith('db:')) {
                        const dbKey = panoVal.replace('db:', '');
                        if (window.ProductCatalog && typeof window.ProductCatalog.getAsset === 'function') {
                            matchedPanoSrc = await window.ProductCatalog.getAsset(dbKey);
                        }
                    } else {
                        // Accept /uploads/..., absolute http/https URLs, data: URIs, or relative asset paths
                        matchedPanoSrc = panoVal;
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
                // A deleted product and a product with no panorama are different answers.
                // Both used to say "No 3D Image Available", so a tour URL for a product
                // that no longer exists still looked like a real, merely empty, tour.
                const gone = !matched && !!targetCode;
                const title = gone ? 'Product not found' : 'No 3D Image Available';
                const detail = gone
                    ? 'This product is no longer in the catalogue. It may have been removed.'
                    : 'No 360° panorama image has been uploaded for this product.';

                viewerEl.innerHTML = `
                    <div style="position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #0c0a09; color: #fff; text-align: center; padding: 24px; z-index: 1000;">
                        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="1.5" style="margin-bottom: 18px;">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                        </svg>
                        <h2 style="font-size: 1.5rem; margin-bottom: 8px; font-weight: 600; letter-spacing: -0.01em;"></h2>
                        <p style="font-size: 0.85rem; color: rgba(255,255,255,0.45); max-width: 340px; line-height: 1.45;"></p>
                        <a href="/" style="margin-top: 22px; font-size: 0.78rem; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(255,255,255,0.55); text-decoration: none; border-bottom: 1px solid rgba(255,255,255,0.25); padding-bottom: 3px;">Back to the collection</a>
                    </div>
                `;
                // textContent: the code in the message comes from the address bar.
                viewerEl.querySelector('h2').textContent = title;
                viewerEl.querySelector('p').textContent = detail;

                const roomNameEl = document.getElementById('room-name');
                if (gone && roomNameEl) roomNameEl.textContent = 'Not found';
                const subEl = document.getElementById('header-subtitle');
                if (gone && subEl) subEl.textContent = 'PRODUCT REMOVED';
            }
            return;
        }

        // Build hotspots: Only load specific hotspots for this room if they exist;
        // if none are defined on the tour itself, show NO hotspots (prevent #4006 from auto-appearing on clean tours).
        let hotspots = [];
        if (matched && Array.isArray(matched.hotspots) && matched.hotspots.length > 0) {
            hotspots = matched.hotspots.map((hs, index) => {
                const hsNorm = normCode(hs.code);
                const productMeta = products3D.find(p => normCode(p.code) === hsNorm) || { code: hs.code, name: hs.code };
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
            // A tour left open in a background tab keeps its graphics context, and a
            // browser grants only a handful across every tab. Hand it back when the page
            // is hidden or closed, so other tabs - and the admin's hotspot preview - can
            // still get one. pageshow re-creates it if the tab is returned to.
            window.addEventListener('pagehide', function () {
                try {
                    if (viewer && typeof viewer.destroy === 'function') viewer.destroy();
                } catch (e) { }
                const el = document.getElementById('panorama-viewer');
                if (el) {
                    el.querySelectorAll('canvas').forEach(function (c) {
                        try {
                            const gl = c.getContext('webgl') || c.getContext('experimental-webgl');
                            const lose = gl && gl.getExtension('WEBGL_lose_context');
                            if (lose) lose.loseContext();
                        } catch (e) { }
                    });
                }
            });

            window.addEventListener('pageshow', function (e) {
                // Restored from the back/forward cache with its context surrendered.
                if (e.persisted) window.location.reload();
            });

            currentPanoramaSrc = panoramaSrc;
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

    /**
     * Read-only diagnostic for the blur report - logs WebGL state and never touches it.
     * A prior attempt patched texParameteri/texImage2D directly and broke rendering on
     * a device that hit a code path (pannellum splits an image wider than the GPU's
     * MAX_TEXTURE_SIZE into two half-width textures) this environment never exercises.
     * This only reads state, so it cannot break anything - the goal is real numbers
     * from an actual device before touching rendering again.
     */
    function logPanoramaDiagnostics() {
        try {
            const canvas = document.querySelector('#panorama-viewer canvas');
            if (!canvas) { console.log('[pano-diag] no canvas found'); return; }
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            if (!gl) { console.log('[pano-diag] no WebGL context'); return; }
            const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
            const minFilter = gl.getTexParameter(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER);
            const filterNames = { 9728: 'NEAREST', 9729: 'LINEAR', 9984: 'NEAREST_MIPMAP_NEAREST', 9985: 'LINEAR_MIPMAP_NEAREST', 9986: 'NEAREST_MIPMAP_LINEAR', 9987: 'LINEAR_MIPMAP_LINEAR' };
            console.log('[pano-diag]', JSON.stringify({
                canvasSize: canvas.width + 'x' + canvas.height,
                canvasClientSize: canvas.clientWidth + 'x' + canvas.clientHeight,
                devicePixelRatio: window.devicePixelRatio,
                maxTextureSize: maxTextureSize,
                currentMinFilter: filterNames[minFilter] || minFilter,
                glError: gl.getError(),
                userAgent: navigator.userAgent
            }));
        } catch (e) {
            console.log('[pano-diag] failed:', e.message);
        }
    }

    function onViewerLoaded() {
        logPanoramaDiagnostics();
        measurePanorama();
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
            const targetNorm = normCode(targetCode);
            const matched = products3D.find(p => {
                const cCode = normCode(p.code);
                const cSlug = normCode(p.slug);
                const cId = normCode(p.id);
                return targetNorm === cCode || targetNorm === cSlug || targetNorm === cId;
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

    /**
     * How far in the viewer may zoom before it starts stretching the image.
     *
     * An equirectangular panorama spreads its width across the full 360 degrees, so an
     * 8192px file holds only ~22.8 pixels per degree. Zoomed in past the point where the
     * screen needs more than that, the viewer can only enlarge existing pixels, which
     * looks soft however the file was uploaded. The old fixed limit of 30 degrees meant
     * a 1.5x stretch on a typical laptop - the blur that was reported. The limit is now
     * the view where one screen pixel meets one image pixel at the centre.
     *
     * Device pixel ratio is capped at 2: past that the stretch is too fine to see, and
     * counting every pixel of a 3x phone screen would leave almost no zoom at all.
     */
    function nativeMinHfov() {
        const canvas = document.querySelector('#panorama-viewer canvas');
        if (!canvas || !canvas.clientWidth || !panoramaImageWidth) return 30;
        const screenPx = canvas.clientWidth * Math.min(window.devicePixelRatio || 1, 2);
        const imagePxPerRadian = panoramaImageWidth / (2 * Math.PI);
        const hfov = 2 * Math.atan((screenPx / 2) / imagePxPerRadian) * 180 / Math.PI;
        return Math.min(90, Math.max(30, hfov));
    }

    function applyNativeZoomLimit() {
        if (!viewer || typeof viewer.setHfovBounds !== 'function') return;
        const min = nativeMinHfov();
        viewer.setHfovBounds([min, 120]);
        if (viewer.getHfov() < min) viewer.setHfov(min, false);
    }

    function measurePanorama() {
        if (!currentPanoramaSrc) return;
        const img = new Image();
        img.onload = function () {
            panoramaImageWidth = img.naturalWidth || 0;
            applyNativeZoomLimit();
        };
        img.src = currentPanoramaSrc;
    }

    window.addEventListener('resize', applyNativeZoomLimit);

    // ---- Controls ----
    function handleZoomIn() {
        if (!viewer) return;
        const current = viewer.getHfov();
        const min = typeof viewer.getHfovBounds === 'function' ? viewer.getHfovBounds()[0] : 30;
        viewer.setHfov(Math.max(current - 10, min), 300);
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

    /**
     * Fullscreen, including on phones.
     *
     * Two things broke it on mobile. Safari exposes the Fullscreen API only under a
     * webkit prefix, so document.fullscreenElement was always undefined and the toggle
     * only ever tried to enter; and on iPhone the API does not work on ordinary elements
     * at all - only on <video> - so the request silently did nothing.
     *
     * Where the real API exists it is used, prefixes included. Where it does not, the
     * viewer is pinned to the whole viewport with CSS instead, which is the only way to
     * fill an iPhone screen and behaves the same from the visitor's side.
     */
    const FS_EL = () => document.fullscreenElement || document.webkitFullscreenElement ||
                         document.msFullscreenElement || null;

    function fullscreenSupported(elem) {
        return !!(elem.requestFullscreen || elem.webkitRequestFullscreen ||
                  elem.msRequestFullscreen);
    }

    function handleFullscreen() {
        const elem = document.getElementById('app-container');
        if (!elem) return;

        // Detect if already in any fullscreen mode (native or pseudo)
        const inNative = !!FS_EL();
        const inPseudo = elem.classList.contains('is-pseudo-fullscreen');
        const isCurrentlyFullscreen = inNative || inPseudo;

        if (isCurrentlyFullscreen) {
            // EXIT FULLSCREEN
            if (inNative) {
                const exit = document.exitFullscreen || document.webkitExitFullscreen ||
                             document.msExitFullscreen;
                if (exit) {
                    try { exit.call(document); } catch (e) { }
                }
            }
            elem.classList.remove('is-pseudo-fullscreen');
            document.body.classList.remove('pseudo-fullscreen-open');
            updateFullscreenIcon();
            showToast('Exited fullscreen');
        } else {
            // ENTER FULLSCREEN
            const enterPseudo = () => {
                elem.classList.add('is-pseudo-fullscreen');
                document.body.classList.add('pseudo-fullscreen-open');
                updateFullscreenIcon();
                showToast('⛶ Fullscreen view');
            };

            // Detect mobile Safari / iOS (which blocks Fullscreen API on divs)
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

            if (isIOS || !fullscreenSupported(elem)) {
                enterPseudo();
            } else {
                const req = elem.requestFullscreen || elem.webkitRequestFullscreen ||
                            elem.msRequestFullscreen;
                try {
                    const r = req.call(elem);
                    if (r && typeof r.then === 'function') {
                        r.then(() => {
                            updateFullscreenIcon();
                            showToast('⛶ Fullscreen view');
                        }).catch(() => {
                            enterPseudo();
                        });
                    } else {
                        setTimeout(() => {
                            if (!FS_EL()) {
                                enterPseudo();
                            } else {
                                updateFullscreenIcon();
                                showToast('⛶ Fullscreen view');
                            }
                        }, 150);
                    }
                } catch (e) {
                    enterPseudo();
                }
            }
        }
        onFirstInteraction();
    }

    function updateFullscreenIcon() {
        const elem = document.getElementById('app-container');
        const on = !!FS_EL() || (elem && elem.classList.contains('is-pseudo-fullscreen'));
        if (fullscreenIcon) fullscreenIcon.style.display = on ? 'none' : 'block';
        if (exitFullscreenIcon) exitFullscreenIcon.style.display = on ? 'block' : 'none';
        
        // Resize Pannellum canvas to fit the exact viewport dimensions smoothly
        const triggerResize = () => {
            if (viewer && typeof viewer.resize === 'function') {
                try { viewer.resize(); } catch (e) {}
            }
        };
        setTimeout(triggerResize, 60);
        setTimeout(triggerResize, 160);
        setTimeout(triggerResize, 350);
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

        try {
            viewer.startOrientation();
        } catch (e) {
            console.warn('Error starting orientation:', e);
        }

        isGyroActive = true;
        btnGyro.classList.add('active', 'gyro-active');
        showToast('📱 Motion sensor enabled — tilt to look around');
        onFirstInteraction();

        // Auto-rotate fights the sensor for control of the camera.
        if (isAutoRotating) {
            viewer.stopAutoRotate();
            isAutoRotating = false;
            btnAutoRotate.classList.remove('active');
        }
    }

    function disableGyro() {
        if (!viewer) return;

        // Stop native Pannellum device orientation control
        try {
            viewer.stopOrientation();
        } catch (e) {
            console.warn('Error stopping orientation:', e);
        }

        isGyroActive = false;
        btnGyro.classList.remove('active', 'gyro-active');
        showToast('Motion sensor disabled');
    }

    function showGyroModal() {
        if (gyroModal) gyroModal.style.display = 'flex';
    }

    function hideGyroModal() {
        if (gyroModal) gyroModal.style.display = 'none';
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
                console.warn('Direct gyro permission error, showing modal fallback:', err);
                showGyroModal();
            }
        } else {
            // Android / non-iOS — permission is automatic
            gyroPermissionGranted = true;
            enableGyro();
        }
    }

    async function handleGyroToggle() {
        if (!hasGyroscope()) {
            showToast('⚠️ Gyroscope not available on this device');
            return;
        }

        if (isGyroActive) {
            disableGyro();
            return;
        }

        // If permission already granted, just enable immediately
        if (gyroPermissionGranted) {
            enableGyro();
            return;
        }

        // Directly request permission during user touch/click gesture (required by iOS 13+)
        await requestGyroPermission();
    }

    // Modal button handlers (safety fallback)
    if (gyroModalCancel) gyroModalCancel.addEventListener('click', hideGyroModal);
    if (gyroModalAllow) {
        gyroModalAllow.addEventListener('click', () => {
            hideGyroModal();
            requestGyroPermission();
        });
    }

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

    /** Resolves a product's sheet, whether it is a URL or a local IndexedDB key. */
    async function resolveFullsheetSrc(product) {
        const raw = product && product.fullsheetUrl ? String(product.fullsheetUrl) : '';
        if (!raw) return null;
        if (raw.startsWith('db:')) {
            const key = raw.replace('db:', '');
            if (window.ProductCatalog && typeof window.ProductCatalog.getAsset === 'function') {
                return await window.ProductCatalog.getAsset(key);
            }
            return null;
        }
        return raw;
    }

    async function openFullsheet() {
        // Load this tour's sheet. Previously only a hotspot click set the image, so the
        // toolbar button opened whatever was last shown - by default the placeholder.
        const src = await resolveFullsheetSrc(currentProduct);
        const titleArea = document.querySelector('.fullsheet-title-area span');

        if (src) {
            fullsheetImage.src = src;
            fullsheetImage.style.display = '';
            if (titleArea && currentProduct) {
                titleArea.textContent = [currentProduct.code, currentProduct.name]
                    .filter(Boolean).join(' - ') + ' Fullsheet';
            }
        } else {
            fullsheetImage.removeAttribute('src');
            fullsheetImage.style.display = 'none';
            if (titleArea) titleArea.textContent = 'No full sheet uploaded for this product';
        }

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
    document.addEventListener('webkitfullscreenchange', updateFullscreenIcon);
    document.addEventListener('MSFullscreenChange', updateFullscreenIcon);

    // Leaving pseudo-fullscreen with the phone's back gesture or the Escape key.
    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const elem = document.getElementById('app-container');
        if (elem && elem.classList.contains('is-pseudo-fullscreen')) {
            elem.classList.remove('is-pseudo-fullscreen');
            document.body.classList.remove('pseudo-fullscreen-open');
            updateFullscreenIcon();
        }
    });

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
