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

    // ---- Product Hotspots ----
    // Add your products here. Each entry needs:
    //   name  — the label text shown floating in the panorama
    //   pitch — vertical angle (-90 bottom to +90 top)
    //   yaw   — horizontal angle (-180 to 180, 0 = center of image)
    const productHotspots = [
        { name: '#4006', pitch: 23, yaw: 0 },
        // To add more products, copy the line above and change name/pitch/yaw.
        // Example: { name: 'Product Name', pitch: 10, yaw: -45 },
    ];

    // Creates the floating product label DOM element for a hotspot
    function createProductTooltip(hotspotDiv, productName) {
        const wrapper = document.createElement('div');
        wrapper.className = 'product-label';

        const dot = document.createElement('span');
        dot.className = 'product-label-dot';

        const text = document.createElement('span');
        text.className = 'product-label-text';
        text.textContent = productName;

        wrapper.appendChild(dot);
        wrapper.appendChild(text);
        hotspotDiv.appendChild(wrapper);
    }

    // ---- Initialize Pannellum ----
    function initViewer() {
        // Build hotspot config from product list
        const hotspots = productHotspots.map((product, index) => ({
            id: `product-hotspot-${index}`,
            pitch: product.pitch,
            yaw: product.yaw,
            type: 'info',
            cssClass: 'product-hotspot',
            createTooltipFunc: createProductTooltip,
            createTooltipArgs: product.name
        }));

        viewer = pannellum.viewer('panorama-viewer', {
            type: 'equirectangular',
            panorama: 'src/360img.jpeg',
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
            pitch: 0,
            yaw: 0,
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

        // Update compass & info in real-time
        viewer.on('mousedown', onFirstInteraction);
        viewer.on('touchstart', onFirstInteraction);

        // Continuous update loop for compass and info
        requestAnimationFrame(updateLoop);
    }

    function onViewerLoaded() {
        // Hide loading, show app
        loadingScreen.classList.add('hidden');
        appContainer.classList.add('visible');
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
        await simulateLoading();
        initViewer();
    }

    // Start on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }

})();
