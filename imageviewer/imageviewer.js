/** class for viewing images fullscreen with panning and zooming */

/**
 * constructor
 * @param {object} viewerConfig
 * @param	{string}	[viewerConfig.galleryID]	If this image viewer is being used for a gallery of multiple images, set the id here
 * @param	{string}	[viewerConfig.gate]		Used to set the type of gating to use on blocked content. Can be 'register', 'age' or 'filter'
 * @param	{string}	[viewerConfig.rendering]	Either blank, or 'pixelated'
 * @param	{string}	[viewerConfig.index]		If this image is part of a gallery, this is the index it apears at in the gallery array
 * @param	{string}	[viewerConfig.max_scale]	A number indicating the maximum scale the image can soom (1 = 100%)
 * @param	{string}	[viewerConfig.caption]	Caption text to show under the image
 */
const ngImageViewer = function (viewerConfig) {
  const _this = this;
  let config = viewerConfig || {};

  // check dependencies
  if (typeof jQuery === 'undefined') {
    throw 'ngImageViewer requires jQuery!';
  }
  if (typeof Hammer === 'undefined') {
    throw 'ngImageViewer requires Hammer.js!';
  }
  const $ = jQuery;

  // figure out what gallery we're using
  let gallery =
    typeof config.galleryID === 'undefined'
      ? ngImageViewer.currentGallery
      : config.galleryID;

  // private vars
  const rendering_options = [
    { label: 'Smooth', css: '' },
    { label: 'Pixelated', css: 'pixelated' },
  ];

  const panSpeed = { x: 0, y: 0 };
  const pan_thrust = 0.5;
  const max_panSpeed = 40; // for keyboard panning
  const min_panSpeed = -max_panSpeed;
  const imgPos = { x: 0, y: 0 };
  const scaleStep = 1 / 0.005;

  const scale_factor = 0.005;

  const pixelZooms = [];

  // the overall html template for rendering the image viewer
  let template = `
<div class="ngImageViewer">
<div data-elem="touchArea">
<img data-elem="image" draggable="false"/>
</div>
<div data-elem="gate"></div>
<div class="ui" data-elem="ui">
<div class="nav-prev">
<button class="nav-prev" data-elem="nav-prev"><span><i class="fas fa-caret-left"></i></span></button>
</div>
<div>
					<button class="ui-zoom" data-elem="zoom-out"><span><i class="fa fa-search-minus"></i></span></button>
					</div>
					<div>
					<button class="ui-zoom" data-elem="zoom-in"><span><i class="fa fa-search-plus"></i></span></button>
					</div>
				<div>
					<button class="ui-zoom" data-elem="zoom-100"><span><i class="fa fa-expand"></i></span></button>
				</div>
				<div>
					<button class="ui-zoom" data-elem="zoom-fill"><span><i class="fa fa-compress"></i></span></button>
				</div>
				<div class="fill">
					<div class="img-caption" data-elem="caption-container">
						<div class="fill"></div>
						<div>
							<p data-elem="caption">This is where the ol' caption goes!</p>
						</div>
						<div class="fill"></div>
						</div>
						</div>
						<div>
						<button class="ui-close" data-elem="close"><span>X</span></button>
						</div>
						<div class="nav-next">
						<button class="nav-next" data-elem="nav-next"><span><i class="fas fa-caret-right"></i></span></button>
						</div>
						</div>
						<div class="spinner" data-elem="spinner">
						<div><em class="fa fa-spin fa-spinner"></em></div>
						</div>
						</div>
						`;

  // template for gating blocked images for unregistered users
  const template_registration_gate = `
						<div class="img-gate">
						<div class="fill"></div>
			<div class="inner">
			<div class="flexbox align-center">
			<h3 class="flex-1"><em class="fa fa-ban"></em> Blocked Content</h3>
			<div class="padded-left"><span data-item="rating"></span></div>
			</div>
			<p>This image is not approved for users under the age of 18.</p>
			<p>Please <a href="#" data-elem="login-btn">sign in</a> to verify your age.</p>
			</div>
			<div class="fill"></div>
			</div>
			`;

  // template for gating blocked images for registered users who use content filters
  const template_filter_gate = `
			<div class="img-gate">
			<div class="fill"></div>
			<div class="inner">
				<div class="flexbox align-center">
					<h3 class="flex-1"><em class="fa fa-ban"></em> Blocked Content</h3>
					<div class="padded-left"><span data-item="rating"></span></div>
					</div>
					<p>This image is blocked by your suitability filters.</p>
					<p><a href="#" data-elem="show-img-btn">Show Image Anyway</a></p>
					</div>
					<div class="fill"></div>
					</div>
					`;

  // template for gating adult images for minors
  const template_age_gate = `
		<div class="img-gate">
			<div class="fill"></div>
			<div class="inner">
			<div class="flexbox align-center">
			<h3 class="flex-1"><em class="fa fa-ban"></em> Blocked Content</h3>
			<div class="padded-left"><span data-item="rating"></span></div>
			</div>
			<p>This image is not approved for users under the age of 18.</p>
			</div>
			<div class="fill"></div>
		</div>
	`;

  let index = null;
  let caption = null;
  let max_scale = 1;
  let min_scale = 1;
  let scale = 1;
  let frameWidth = 640;
  let frameHeight = 640;
  let velocity = { x: 0, y: 0 };
  let anchor = { x: 0, y: 0 };
  let scrollSteps = 2000;

  let imgWidth;
  let imgHeight;
  let currentWidth;
  let currentHeight;
  let pinch_zoom;

  let $view;
  let $img;
  let $gate;
  let $ui;
  let $touchArea;
  let $spinner;
  let $caption;
  let $caption_container;
  let $nav_next;
  let $nav_prev;
  let ui_timeout;
  let mouse_is_down = false;
  let mouse_just_released = false;
  let can_pan = true;
  let mousePos = { x: 0, y: 0 };
  let pointerId = null;
  let requestFrames = false;
  let gate = false;
  let rendering = '';

  // initializes the image viewer
  function init() {
    rendering = '';
    max_scale = 1;
    caption = null;
    gate = false;

    // apply settings from the config object
    if (typeof config === 'object') {
      if (typeof config.gate !== 'undefined') {
        gate = config.gate;
      }

      if (typeof config.rendering === 'string') {
        this.setRendering(config.rendering);
      }

      if (typeof config.index === 'number') {
        this.setIndex(config.index);
      }

      if (typeof config.max_scale !== 'undefined') {
        this.setMaxScale(config.max_scale);
      }
      this.setCaption(
        typeof config.caption !== 'undefined' ? config.caption : null,
      );
    }
  }

  function hideUiLoadingPhase() {
    // hide all the zoom buttons
    for (const $btn of $zoom_btns) {
      $btn.hide();
    }
  }

  function showUiLoadingPhase() {
    // show all the zoom buttons
    for (const $btn of $zoom_btns) {
      $btn.show();
    }
  }

  // setters

  this.setIndex = (_index) => {
    index = _index;
  };

  this.setCaption = (_caption) => {
    caption = _caption;
  };

  this.setRendering = function (_rendering) {
    for (const option of rendering_options) {
      if (_rendering === option.css) rendering = option.css;
    }
    return this;
  };

  this.setMaxScale = function (maxScale) {
    const max = Number.parseFloat(maxScale);
    if (!Number.isNaN(max) && max > 0) max_scale = max;
    return this;
  };

  this.setTemplate = (html) => {
    template = html;
  };

  // sets the image URL and does any UI updates that go with it
  // TODO - add a config option where we can pass in a smaller preview image, width, height, etc
  this.setImage = (src) => {
    // hide navigation UI
    hideUiLoadingPhase();

    $gate.html('');
    $gate.hide();
    $caption_container.hide();

    if (!$img || !$img.length) return;

    const img = $img[0];
    $img.css('visibility', 'hidden');
    function showMe() {
      _this.resetImage();
      if ($spinner) $spinner.hide();
      $img.css('visibility', '');

      // show navigation UI
      showUiLoadingPhase();
    }
    img.onload = showMe;

    if (ngImageViewer.gateType && gate) {
      // show navigation UI
      showUiLoadingPhase();

      if ($spinner) $spinner.hide();

      let $gateInner;

      let gateType = ngImageViewer.gateType;
      if (gateType === 'age' && gate !== 'a') gateType = 'filter';

      switch (gateType) {
        case 'register':
          $gate.show();
          $gateInner = $(template_registration_gate);

          $gate.append($gateInner);

          $('[data-elem="login-btn"]', $gateInner).click((e) => {
            e.preventDefault();
            e.stopPropagation();
            PassportHandler.open();
          });

          break;

        case 'filter':
          $gate.show();
          $gateInner = $(template_filter_gate);

          $gate.append($gateInner);

          $('[data-elem="show-img-btn"]', $gateInner).click((e) => {
            e.preventDefault();
            e.stopPropagation();
            if ($spinner) $spinner.show();
            $gate.hide();
            img.src = src;
            if (gallery >= 0 && index !== null) {
              ngImageViewer.galleries[gallery][index].config.gate = false;
            }
          });

          break;

        default:
          $gate.show();
          $gateInner = $(template_age_gate);

          break;
      }

      $('[class="inner"]', $gateInner).addClass(
        `background-color-rated-${gate}`,
      );
      $('[data-item="rating"]', $gateInner).addClass(`ngicon-25-rated-${gate}`);
    } else {
      img.src = src;
      if (caption) {
        $caption.text(caption);
        $caption_container.show();
      }
    }

    $nav_prev.hide();
    $nav_next.hide();

    if (index !== null) {
      if (index > 0) {
        $nav_prev.show();
      }
      if (index < ngImageViewer.galleries[gallery].length - 1) {
        $nav_next.show();
      }
    }
  };

  this.open = function (image) {
    ngImageViewer.isOpen = true;

    $view = $(template);

    $view.css('opacity', 0).css('transition', 'opacity 0.5s');
    setTimeout(() => {
      $view.css('opacity', '100%');
    }, 10);

    $img = $('img[data-elem="image"]', $view);
    $gate = $('[data-elem="gate"]', $view);
    $ui = $('[data-elem="ui"]', $view);
    $spinner = $('[data-elem="spinner"]', $view);

    $close_btn = $('[data-elem="close"]', $ui);
    $zoom_in_btn = $('[data-elem="zoom-in"]', $ui);
    $zoom_100_btn = $('[data-elem="zoom-100"]', $ui);
    $zoom_fill_btn = $('[data-elem="zoom-fill"]', $ui);
    $zoom_out_btn = $('[data-elem="zoom-out"]', $ui);

    $caption = $('[data-elem="caption"]', $ui);
    $caption_container = $('[data-elem="caption-container"]', $ui);

    $nav_next = $('[data-elem="nav-next"]', $ui);
    $nav_prev = $('[data-elem="nav-prev"]', $ui);

    $zoom_btns = [$zoom_in_btn, $zoom_out_btn, $zoom_100_btn, $zoom_fill_btn];

    $nav_next.click((e) => {
      e.preventDefault();
      nextImage();
    });

    $nav_prev.click((e) => {
      e.preventDefault();
      prevImage();
    });

    showUI();
    $('body').append($view);

    $touchArea = $('[data-elem="touchArea"]');

    $touchArea.on('mousewheel DOMMouseScroll', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onWheel(e.originalEvent);
    });

    const hmr = new Hammer($touchArea[0]);
    hmr.get('pan').set({ direction: Hammer.DIRECTION_ALL });
    const pinch = new Hammer.Pinch();
    hmr.add(pinch);

    hmr.on('swipeleft', () => {
      if (
        scale === min_scale &&
        index < ngImageViewer.galleries[gallery].length - 1
      )
        nextImage();
    });
    hmr.on('swiperight', () => {
      if (scale === min_scale && index > 0) prevImage();
    });

    hmr.on('panstart', (ev) => {
      if ($img && can_pan && pointerId === null) {
        const e = ev.changedPointers[0];
        pointerId = e.pointerId;
        $img.css('transition', '');
        mousePos = {
          x: e.clientX,
          y: e.clientY,
        };
      }
    });

    hmr.on('panend', (ev) => {
      if (pointerId === null) return;

      let found = false;
      for (let i = 0; i < ev.changedPointers.length; i++) {
        if (ev.changedPointers[i].pointerId === pointerId) found = true;
      }
      if (!found) return;

      pointerId = null;
    });

    hmr.on('pan', (ev) => {
      if (can_pan) {
        let e = null;
        for (let i = 0; i < ev.changedPointers.length; i++) {
          if (ev.changedPointers[i].pointerId === pointerId) {
            e = ev.changedPointers[i];
            break;
          }
        }
        if (!e) return;

        panImage(e.clientX - mousePos.x, e.clientY - mousePos.y);
        mousePos = {
          x: e.clientX,
          y: e.clientY,
        };
      }
    });

    hmr.on('pinch', (ev) => {
      can_pan = false;
      updateScale(null, pinch_zoom * ev.scale);
    });

    hmr.on('pinchstart', (ev) => {
      if ($img) $img.css('transition', '');
      pinch_zoom = scale;
      anchor = ev.center;
    });

    hmr.on('pinchend', (_e) => {
      setTimeout(() => {
        can_pan = true;
      }, 1);
    });

    let _last = new Date().getTime();

    hmr.on('tap', (ev) => {
      const _now = new Date().getTime();
      const diff = _now - _last;
      if (diff < 330) {
        _last = 0;
        anchor = ev.center;
        toggleZoom();
        ev.srcEvent.preventDefault();
        ev.srcEvent.stopPropagation();
        return;
      }

      _last = _now;

      if (
        ev.center.x < imgPos.x ||
        ev.center.x > imgPos.x + currentWidth ||
        ev.center.y < imgPos.y ||
        ev.center.y > imgPos.y + currentHeight
      ) {
        _this.close();
      }

      if (ev.pointerType === 'touch') {
        mouse_just_released = true;
        showUI(true);

        setTimeout(() => {
          mouse_just_released = false;
        }, 250);
      }
    });

    $zoom_in_btn.click((e) => {
      e.preventDefault();
      e.stopPropagation();
      anchor = {
        x: frameWidth / 2,
        y: frameHeight / 2,
      };
      if ($img)
        $img.css(
          'transition',
          imgWidth <= 6000 && imgHeight <= 6000 ? 'transform 0.4s' : '',
        );

      if (rendering === 'pixelated') {
        let newScale = pixelZooms[0];
        for (const z of pixelZooms) {
          if (z > scale && z < newScale) {
            newScale = z;
          }
        }
        updateScale(null, newScale);
      } else {
        updateScale(0.1);
      }
    });

    $zoom_out_btn.click((e) => {
      e.preventDefault();
      e.stopPropagation();
      anchor = {
        x: frameWidth / 2,
        y: frameHeight / 2,
      };
      if ($img)
        $img.css(
          'transition',
          imgWidth <= 6000 && imgHeight <= 6000 ? 'transform 0.4s' : '',
        );
      if (rendering === 'pixelated') {
        let newScale = pixelZooms[pixelZooms.length - 1];
        for (const z of pixelZooms) {
          if (z < scale && z > newScale) {
            newScale = z;
          }
        }
        updateScale(null, newScale);
      } else {
        updateScale(-0.1);
      }
    });

    $zoom_100_btn.click((e) => {
      e.preventDefault();
      e.stopPropagation();
      anchor = {
        x: frameWidth / 2,
        y: frameHeight / 2,
      };
      zoom100();
    });

    $zoom_fill_btn.click((e) => {
      e.preventDefault();
      e.stopPropagation();
      anchor = {
        x: frameWidth / 2,
        y: frameHeight / 2,
      };
      zoomFill();
    });

    $close_btn.click((e) => {
      e.preventDefault();
      e.stopPropagation();
      _this.close();
    });

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('wheel', onWheel);
    window.addEventListener('resize', onResize);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    requestFrames = true;
    window.requestAnimationFrame(onAnimationFrame);
    this.setImage(image);
  };

  this.close = () => {
    ngImageViewer.isOpen = false;

    $ui.remove();
    $img = null;
    $ui = null;
    $touchArea = null;

    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
    window.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('wheel', onWheel);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    requestFrames = false;

    $view.css('opacity', 0);
    setTimeout(() => {
      $view.remove();
      $view = null;
    }, 501);
  };

  this.resetImage = (useScale, reframe) => {
    const oldFrame = reframe === true ? [frameWidth, frameHeight] : null;

    resetFrame();

    if ($img) {
      $img.css('transition', '').css('image-rendering', rendering);
      imgWidth = $img[0].naturalWidth;
      imgHeight = $img[0].naturalHeight;
      maxWidth = imgWidth * max_scale;
      maxHeight = imgHeight * max_scale;
      scale = 1;
    }

    let zooms = max_scale;
    while (zooms > 0) {
      pixelZooms.push(zooms);
      zooms--;
    }

    if (imgWidth > frameWidth || imgHeight > frameHeight) {
      if (rendering === 'pixelated') {
        let fitWidth = imgWidth;
        let fitHeight = imgHeight;
        while (fitWidth > frameWidth || fitHeight > frameHeight) {
          scale *= 0.5;
          fitWidth *= 0.5;
          fitHeight *= 0.5;
          pixelZooms.push(scale);
        }
      } else {
        const hScale = frameWidth / imgWidth;
        const vScale = frameHeight / imgHeight;
        scale = hScale < vScale ? hScale : vScale;
        scale = Math.floor(scale / scale_factor) * scale_factor;
      }
    }

    min_scale = scale;

    if (useScale) {
      scale = useScale;
      if (scale > max_scale) scale = max_scale;
      else if (scale < min_scale) scale = min_scale;
    }

    $zoom_in_btn.show();
    $zoom_100_btn.show();
    $zoom_fill_btn.show();
    $zoom_out_btn.show();

    if (min_scale === max_scale) {
      $zoom_in_btn.hide();
      $zoom_100_btn.hide();
      $zoom_fill_btn.hide();
      $zoom_out_btn.hide();
    }
    if (max_scale > 1 && min_scale === 1) {
      $zoom_100_btn.hide();
    }

    anchor = {
      x: frameWidth / 2,
      y: frameHeight / 2,
    };

    updateScale(0, null, oldFrame);

    let range = imgWidth - currentWidth;
    const minRange = 1000 * max_scale;
    if (range < minRange) range = minRange;

    scrollSteps = Math.ceil(range * 5) / 5;
  };

  function zoom100() {
    if ($img)
      $img.css(
        'transition',
        imgWidth <= 6000 && imgHeight <= 6000 ? 'transform 0.4s' : '',
      );
    updateScale(null, 1);
  }

  function zoomFill() {
    if ($img)
      $img.css(
        'transition',
        imgWidth <= 6000 && imgHeight <= 6000 ? 'transform 0.4s' : '',
      );
    updateScale(null, min_scale);
  }

  function zoomMax() {
    if ($img)
      $img.css(
        'transition',
        imgWidth <= 6000 && imgHeight <= 6000 ? 'transform 0.4s' : '',
      );
    updateScale(null, max_scale);
  }

  function toggleZoom() {
    if (scale === 1 && max_scale > 1) zoomMax();
    else if (scale >= 1) zoomFill();
    else zoom100();
  }

  function panImage(x, y) {
    if (x || y) {
      velocity = { x: x, y: y };
    }
    let max_x = imgPos.x > 0 ? imgPos.x : 0;
    let min_x = frameWidth - currentWidth;

    let max_y = imgPos.y > 0 ? imgPos.y : 0;
    let min_y = frameHeight - currentHeight;

    if (currentWidth < frameWidth) {
      max_x = min_x = Math.round(min_x / 2);
      if (imgPos.x < min_x) min_x = imgPos.x;
      if (imgPos.x > max_x) max_x = imgPos.x;
    }

    if (currentHeight < frameHeight) {
      max_y = min_y = Math.round(min_y / 2);
      if (imgPos.y < min_y) min_y = imgPos.y;
      if (imgPos.y > max_y) max_y = imgPos.y;
    }

    if (imgPos.x < min_x) min_x = imgPos.x;
    if (imgPos.y < min_y) min_y = imgPos.y;

    if (x) imgPos.x += x;
    if (y) imgPos.y += y;

    if (imgPos.x > max_x) imgPos.x = max_x;
    else if (imgPos.x < min_x) imgPos.x = min_x;

    if (imgPos.y > max_y) imgPos.y = max_y;
    else if (imgPos.y < min_y) imgPos.y = min_y;

    updateTransform();
  }

  function updateScale(changeVal, setActual, oldFrame) {
    let _focus;
    let change = changeVal;

    if (oldFrame) {
      _focus = {
        x: (oldFrame[0] / 2 - imgPos.x) / currentWidth,
        y: (oldFrame[1] / 2 - imgPos.y) / currentHeight,
      };
    }

    let newScale = scale;

    if (setActual) {
      newScale = setActual;
    } else {
      if (change) {
        const mod = change > 0 ? 1 : -1;
        change = (Math.ceil(Math.abs(change) * scaleStep) / scaleStep) * mod;
      }
      newScale = Math.round((scale + change) * 1000) / 1000;
    }

    if (newScale > max_scale) newScale = max_scale;
    else if (newScale < min_scale) newScale = min_scale;

    const oldScale = scale;

    scale = newScale;

    if (anchor.x < imgPos.x) anchor.x = imgPos.x;
    else if (anchor.x > imgPos.x + currentWidth)
      anchor.x = imgPos.x + currentWidth;

    if (anchor.y < imgPos.y) anchor.y = imgPos.y;
    else if (anchor.y > imgPos.y + currentHeight)
      anchor.y = imgPos.y + currentHeight;

    const offset = {
      x: ((anchor.x - imgPos.x) / oldScale) * newScale,
      y: ((anchor.y - imgPos.y) / oldScale) * newScale,
    };

    currentWidth = imgWidth * scale;
    currentHeight = imgHeight * scale;

    if (oldFrame) {
      anchor = {
        x: Math.round(frameWidth / 2),
        y: Math.round(frameHeight / 2),
      };

      imgPos.x = Math.round(anchor.x - _focus.x * currentWidth);
      imgPos.y = Math.round(anchor.y - _focus.y * currentHeight);

      if (currentWidth <= frameWidth) {
        imgPos.x = Math.round((frameWidth - currentWidth) / 2);
      } else if (imgPos.x > 0) {
        imgPos.x = 0;
      } else if (imgPos.x < frameWidth - currentWidth) {
        imgPos.x = frameWidth - currentWidth;
      }

      if (currentHeight <= frameHeight) {
        imgPos.y = Math.round((frameHeight - currentHeight) / 2);
      } else if (imgPos.y > 0) {
        imgPos.y = 0;
      } else if (imgPos.y < frameHeight - currentHeight) {
        imgPos.y = frameHeight - currentHeight;
      }

      updateTransform();
    } else {
      if (currentWidth <= frameWidth && currentHeight <= frameHeight) {
        imgPos.x = (frameWidth - currentWidth) / 2;
        imgPos.y = (frameHeight - currentHeight) / 2;
      } else {
        imgPos.x = anchor.x - offset.x;
        imgPos.y = anchor.y - offset.y;
      }

      updateTransform();

      panImage(0, 0);
    }
  }

  function updateTransform() {
    const xForm = `translate(${imgPos.x}px, ${imgPos.y}px) scale(${scale})`;
    if ($img) $img.css('transform', xForm);
  }

  function resetFrame() {
    frameWidth = Math.floor($view.width());
    frameHeight = Math.floor($view.height());
  }

  function hideUI() {
    if (ui_timeout) clearTimeout(ui_timeout);
    if (!$ui) return;
    $ui.css('opacity', '0%');
  }

  function showUI(from_touch) {
    if (!$ui) return;
    $ui.css('opacity', '100%');
    if (ui_timeout) clearTimeout(ui_timeout);
    const time = from_touch === true ? 5000 : 2000;
    if ($('button:hover', $ui).length === 0)
      ui_timeout = setTimeout(hideUI, time);
  }

  function onMouseMove(_e) {
    if (!mouse_is_down && !mouse_just_released) {
      showUI();
    }
  }

  function onMouseUp(_e) {
    mouse_is_down = false;
  }

  function onMouseDown(_e) {
    mouse_is_down = true;
  }

  const keys = {
    esc: 27,
    shift: 16,
    ctrl: 17,
    plusX: 187,
    minusX: 189,
    plus: 107,
    minus: 109,
    up: 38,
    down: 40,
    left: 37,
    right: 39,
    space: 32,
    prev: 188,
    next: 190,
  };

  const keyMap = {};
  const keyState = {};
  for (const i in keys) {
    keyMap[keys[i]] = i;
    keyState[i] = { start: 0, down: 0 };
  }

  function handleKeyDown(key) {
    if (keyState[key].down) return;

    keyState[key].start = new Date().getTime();
    keyState[key].down = 1;

    // handle keys that don't have CTRL'd versions
    if (!keyState.ctrl.down) {
      switch (key) {
        case 'left':
          panSpeed.x = pan_thrust;
          return;

        case 'right':
          panSpeed.x = -pan_thrust;
          return;

        case 'up':
          panSpeed.y = pan_thrust;
          return;

        case 'down':
          panSpeed.y = -pan_thrust;
          return;

        case 'prev':
          if (index > 0) prevImage();
          return;

        case 'next':
          if (index < ngImageViewer.galleries[gallery].length - 1) nextImage();
          return;
      }
    }
  }

  function handleKeyUp(key) {
    const passed = new Date().getTime() - keyState[key].start;
    if (passed < 200) handleKeyPressed(key);

    keyState[key].start = 0;
    keyState[key].down = 0;

    switch (key) {
      case 'left':
      case 'right':
        panSpeed.x = 0;
        return;
      case 'up':
      case 'down':
        panSpeed.y = 0;
        return;
    }
  }

  function handleKeyPressed(key) {
    switch (key) {
      case 'esc':
        _this.close();
        return;
      case 'up':
        if (keyState.ctrl.down) $zoom_in_btn.click();
        return;
      case 'plus':
      case 'plusX':
        $zoom_in_btn.click();
        return;
      case 'down':
        if (keyState.ctrl.down) $zoom_out_btn.click();
        return;
      case 'minus':
      case 'minusX':
        $zoom_out_btn.click();
        return;
      case 'space':
        anchor = {
          x: frameWidth / 2,
          y: frameHeight / 2,
        };
        toggleZoom();
        return;
    }
  }

  function onKeyDown(e) {
    if (typeof keyMap[e.keyCode] === 'undefined') return;
    e.preventDefault();
    e.stopPropagation();
    handleKeyDown(keyMap[e.keyCode]);
  }

  function onKeyUp(e) {
    if (typeof keyMap[e.keyCode] === 'undefined') return;
    e.preventDefault();
    e.stopPropagation();
    handleKeyUp(keyMap[e.keyCode]);
  }

  function onWheel(e) {
    e.preventDefault();
    e.stopPropagation();

    if (!e.deltaY) return;
    const _scale = -(e.deltaY / scrollSteps);

    anchor = {
      x: Number.parseInt(e.clientX),
      y: Number.parseInt(e.clientY),
    };

    if ($img) $img.css('transition', 'transform 0.4s');
    updateScale(_scale);
  }

  function onResize() {
    _this.resetImage(scale, true);
  }

  function onAnimationFrame() {
    if (panSpeed.x !== 0 || panSpeed.y !== 0) {
      if ($img) $img.css('transition', '');

      if (panSpeed.x > 0 && panSpeed.x < max_panSpeed) {
        panSpeed.x += pan_thrust;
        if (panSpeed.x > max_panSpeed) panSpeed.x = max_panSpeed;
      } else if (panSpeed.x < 0 && panSpeed.x > min_panSpeed) {
        panSpeed.x -= pan_thrust;
        if (panSpeed.x < min_panSpeed) panSpeed.x = min_panSpeed;
      }

      if (panSpeed.y > 0 && panSpeed.y < max_panSpeed) {
        panSpeed.y += pan_thrust;
        if (panSpeed.y > max_panSpeed) panSpeed.y = max_panSpeed;
      } else if (panSpeed.y < 0 && panSpeed.y > min_panSpeed) {
        panSpeed.y -= pan_thrust;
        if (panSpeed.y < min_panSpeed) panSpeed.y = min_panSpeed;
      }

      velocity.x = panSpeed.x;
      velocity.y = panSpeed.y;
      panImage(panSpeed.x, panSpeed.y);
    } else if (
      velocity &&
      (Math.abs(velocity.x) >= 0.5 || Math.abs(velocity.y) >= 0.5)
    ) {
      const mod = 0.9;
      velocity.x *= mod;
      velocity.y *= mod;
      panImage(velocity.x, velocity.y);
    }

    if (requestFrames) window.requestAnimationFrame(onAnimationFrame);
  }

  function prevImage() {
    index--;
    if (index < 0) index = ngImageViewer.galleries[gallery].length - 1;

    updateImage();
  }

  function nextImage() {
    index++;
    if (index >= ngImageViewer.galleries[gallery].length) index = 0;

    updateImage();
  }

  function updateImage() {
    config = ngImageViewer.galleries[gallery][index].config;
    init.call(_this);
    _this.setImage(ngImageViewer.galleries[gallery][index].src);
  }

  // get the image config for the selected image
  if (config.galleryID && index === null && typeof config.index === 'number') {
    index = config.index;
    gallery = config.galleryID;

    if (ngImageViewer.galleries[gallery]?.[index]) {
      config = ngImageViewer.galleries[gallery][index].config;
    }
  }

  init.call(this);
};

ngImageViewer.gateType = null;

ngImageViewer.open = (image, config) => {
  const viewer = new ngImageViewer(config);
  viewer.open(image);
};

ngImageViewer.isOpen = false;

ngImageViewer.fromLink = (event, link, config) => {
  event.preventDefault();
  event.stopPropagation();
  new ngImageViewer(config).open(jQuery(link).attr('href'));
};

ngImageViewer.registerClickElement = ($element, src, clickConfig) => {
  config = clickConfig ?? {};
  $element.click((e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  const hmr = new Hammer($element[0]);
  hmr.on('tap', (_e) => {
    if (typeof src === 'string') {
      new ngImageViewer(config).open(src);
    } else {
      new ngImageViewer(src.getConfig()).open(src.getSrc());
    }
  });
};

ngImageViewer.galleries = {};
ngImageViewer.currentGallery = ngImageViewer.autoID = -1;

ngImageViewer.addToGallery = (src, config) => {
  if (typeof config.galleryID === 'undefined')
    config.galleryID = ngImageViewer.currentGallery;
  ngImageViewer.galleries[ngImageViewer.currentGallery].push({
    src: src,
    config: config,
  });
};

ngImageViewer.newGallery = (gallery_id) => {
  if (typeof gallery_id === 'undefined') {
    ngImageViewer.autoID++;
    ngImageViewer.currentGallery = ngImageViewer.autoID;
  } else {
    ngImageViewer.currentGallery = gallery_id;
    if (typeof gallery_id === 'number' && gallery_id > ngImageViewer.autoID) {
      ngImageViewer.autoID = Math.ceil(gallery_id);
    }
  }

  ngImageViewer.galleries[ngImageViewer.currentGallery] = [];
};
