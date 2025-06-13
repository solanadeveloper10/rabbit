class ngImageGallery {
  constructor(
    containerSelector,
    imageData,
    mobile,
    suitabilities,
    globalSuitability,
  ) {
    const $ = jQuery;

    const $body = $('body');

    this.$container = $(containerSelector).first();
    this.$swipeArea = $('div[data-item="swipe-area"]', this.$container).first();
    this.$blockImg = $(
      'div[data-action="block-image"]',
      this.$container,
    ).first();
    this.$showImg = $('a[data-action="show-image"]', this.$container).first();
    this.$viewImg = $('a[data-action="view-image"]', this.$container).first();
    this.$image = $('img[data-item="image"]', this.$container).first();
    this.$thumbNav = $('#gallery-nav', this.$container)
      .first()
      .removeAttr('id');
    this.$thumbRow = $('[data-item="thumbnails"]', this.$container).first();
    this.$thumbs = $('[data-image-index]', this.$thumbRow);
    this.$positionBar = $('[data-item="position-bar"]', this.$thumbNav).first();
    this.isMobile = false;
    if (mobile) this.isMobile = true;
    this.suitabilities = suitabilities;
    this.imageData = imageData;
    this.globalSuitability = globalSuitability;
    this.galleryID = ngImageViewer.currentGallery;

    this.blackout = ngutils.blackout.getByChild(this.$container);

    let selectedImageIndex = 0;
    for (let i = 0; i <= imageData.length; i++) {
      if (suitabilities.includes(imageData[i].suitability)) {
        selectedImageIndex = i;
        break;
      }
    }

    this.setImageIndex(selectedImageIndex);

    this.$image.attr(
      'data-smart-scale',
      `${this.selectedImage.width},${this.selectedImage.height}`,
    );
    this.frame = { w: this.$image.width(), h: this.$image.height() };
    setTimeout(() => {
      this.frame = { w: this.$image.width(), h: this.$image.height() };
    }, 50);

    const $sync_element = this.$image.closest('.ng-img-container-sync');
    this.smartscale = new ngutils.media.smartscale(this.$image);

    if (this.smartscale) {
      this.smartscale.onResized = (w, h) => {
        console.log('resized', w, h, this.frame.h);
        $sync_element.height(this.frame.h);
        $sync_element.animate({ height: h }, 200);
        this.frame = { w: w, h: h };
      };
    }

    this.$showImg.click((e) => {
      e.preventDefault();
      this.setImageIndex(this.imageIndex, true);
    });

    this.$viewImg.click((e) => {
      e.preventDefault();
    });

    this.getSrc = function () {
      return this.selectedImage.image;
    };

    this.getConfig = function () {
      return {
        galleryID: this.galleryID,
        index: this.imageIndex,
        rendering: this.selectedImage.rendering,
        max_scale: this.selectedImage.max_zoom,
      };
    };

    ngImageViewer.registerClickElement(this.$viewImg, this);

    let dragging = false;
    this.$thumbs.click((e) => {
      e.preventDefault();
      if (dragging) return;
      this.setImageIndex(
        Number.parseInt($(e.currentTarget).attr('data-image-index')),
      );
    });

    this.gap = $('[data-image-index="1"]').first().parent().width();

    const $navLeft = $('[data-nav-dir="-1"]', this.$container).first();
    const $navRight = $('[data-nav-dir="1"]', this.$container).first();

    $('[data-action="nav-prev"]', this.$swipeArea).click((e) => {
      e.preventDefault();
      e.stopPropagation();
      $navLeft.click();
    });

    $('[data-action="nav-next"]', this.$swipeArea).click((e) => {
      e.preventDefault();
      e.stopPropagation();
      $navRight.click();
    });

    $(document).on('keydown', (e) => {
      // check if the user cursor is focused on anything that might need to use these keys
      if (
        document.activeElement &&
        (document.activeElement.tagName === 'INPUT' ||
          document.activeElement.tagName === 'TEXTAREA' ||
          document.activeElement.tagName === 'CANVAS' ||
          document.activeElement.isContentEditable)
      ) {
        return;
      }

      if (
        !ngImageViewer?.isOpen &&
        ngutils.element.isOnScreen(this.$container, 0)
      ) {
        if (e.keyCode === 190) {
          e.preventDefault();
          e.stopPropagation();
          $navRight.click();
        } else if (e.keyCode === 188) {
          e.preventDefault();
          e.stopPropagation();
          $navLeft.click();
        }
      }
    });

    function navClick(e) {
      e.preventDefault();
      e.stopPropagation();
      const dir = Number.parseInt($(e.currentTarget).attr('data-nav-dir'));

      let i = this.imageIndex + dir;
      if (i < 0) i = this.imageData.length - 1;
      else if (i >= this.imageData.length) i = 0;

      this.setImageIndex(i);
    }

    $navLeft.click(navClick.bind(this));
    $navRight.click(navClick.bind(this));

    const $modBtn = $('[data-action="moderate"]', this.$container);
    if (typeof ArtEdit !== 'undefined') {
      $modBtn.click((e) => {
        e.preventDefault();
        ArtEdit.open(
          this.selectedImage,
          imageData,
          PHP.get('artmod_baseurl'),
          PHP.get('global_suitability'),
        );
      });
    } else {
      $modBtn.remove();
    }

    let check_drag = false;
    let mouseX = 0;

    const s_hmr = new Hammer(this.$swipeArea[0]);

    function swipeRight(_e) {
      $navLeft.click();
    }

    function swipeLeft() {
      $navRight.click();
    }

    s_hmr.on('swiperight', swipeRight);
    s_hmr.on('swipeleft', swipeLeft);

    function mouseHandler(e) {
      if (!dragging && Math.abs(mouseX - e.clientX) < 3) return;

      if (check_drag) {
        check_drag = false;
        dragging = true;
      }
      if (dragging) {
        this.$thumbRow[0].scrollLeft += mouseX - e.clientX;
        mouseX = e.clientX;
      }
    }

    function stopDrag(_e) {
      check_drag = false;
      if (dragging) {
        setTimeout(() => {
          dragging = false;
        }, 5);
      }
    }

    if (!this.isMobile) {
      this.$thumbRow.on('mousedown', (e) => {
        check_drag = true;
        mouseX = e.clientX;
      });

      $body.on('mousemove', mouseHandler.bind(this));
      $body.on('mouseup', stopDrag);

      this.$thumbRow.on('mouseleave', stopDrag);
    }

    this.destroy = () => {
      // remove any listeners or intervals that could cause a problem
      this.$thumbNav.off();
      this.$thumbs.off();
      this.$showImg.off();
      this.$viewImg.off();
      this.$image.off();
      this.$thumbRow.off();

      $body.off('mousemove', mouseHandler.bind(this));
      $body.off('mouseup', stopDrag);

      s_hmr.on('swiperight', swipeRight);
      s_hmr.on('swipeleft', swipeLeft);
    };

    if (this.blackout) {
      ngutils.event.addListener('blackout-hide', (data) => {
        if (data.instance === this.blackout) {
          this.destroy();
        }
      });
    }

    const needs_scrollbar =
      !this.isMobile &&
      this.$thumbRow.width() < $('.thumbs-inner', this.$thumbRow).width();

    if (!needs_scrollbar) {
      this.$positionBar.remove();
      this.handlePositionBar = () => {};
    } else {
      this.$innerBar = $('div', this.$positionBar).first();
      const bar_width = this.$positionBar.outerWidth();
      const inner_width = this.$innerBar.outerWidth();
      this.range = bar_width - inner_width;

      this.handlePositionBar = function () {
        const pos =
          this.$thumbRow[0].scrollLeft /
          (this.$thumbRow[0].scrollWidth - this.$thumbRow.width());
        const left = Math.round(this.range * pos);
        this.$innerBar.css('left', `${left}px`);
      };
      this.handlePositionBar();

      this.$thumbRow.scroll(() => {
        this.handlePositionBar.call(this);
      });

      // check for scroll wheel over this.$thumbRow and scroll the element accordingly
      this.$thumbRow.on('wheel', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const delta = e.originalEvent.deltaY;
        const scroll = this.$thumbRow.scrollLeft();
        this.$thumbRow.scrollLeft(scroll + delta);
      });
    }
  }

  setImageIndex(imgIndex, skip_suitability_check) {
    const $ = jQuery;

    let index = imgIndex;
    if (index < 0) index = 0;
    else if (index >= this.imageData.length) index = this.imageData.length - 1;

    if (index === this.imageIndex && !skip_suitability_check) return;

    $('[data-image-index]', this.$container).removeClass('selected');

    this.imageIndex = index;
    this.selectedImage = this.imageData[index];

    if (
      ngImageViewer.gateType !== 'filter' &&
      this.selectedImage.suitability === 'a'
    ) {
      this.$showImg.hide();
    } else {
      this.$showImg.show();
    }

    $(`[data-image-index=${this.imageIndex}]`, this.$container).addClass(
      'selected',
    );

    const center = (this.$thumbRow.width() - this.gap) / 2;
    this.$thumbRow.animate({ scrollLeft: index * this.gap - center }, 200);

    // clear any existing animation handlers
    this.$image.stop(true);

    let blocked = false;

    if (!skip_suitability_check) {
      blocked = !this.suitabilities.includes(
        this.selectedImage.suitability
          ? this.selectedImage.suitability
          : this.globalSuitability,
      );
    }

    if (blocked) {
      this.$viewImg.hide();
      this.$blockImg.show();
      this.$image.fadeTo(1, 0);

      if (this.smartscale)
        this.smartscale.setNewDimensions(
          this.selectedImage.width,
          this.selectedImage.height,
        );
    } else {
      this.$viewImg.show();
      this.$blockImg.hide();

      const src = this.selectedImage.medium_image
        ? this.selectedImage.medium_image
        : this.selectedImage.image;
      if (this.smartscale) {
        this.$image.fadeTo(150, 0, () => {
          this.$viewImg.attr('href', this.selectedImage.image);
          this.smartscale.setNewDimensions(
            this.selectedImage.width,
            this.selectedImage.height,
          );
          this.$image[0].onload = () => {
            this.$image.fadeTo(150, 1);
          };
          this.$image.attr('src', src);
        });
      } else {
        this.$viewImg.attr('href', this.selectedImage.image);
        this.$image.attr('src', src);
      }

      // only apply pixelation if we're not shrinking the image
      if (
        this.selectedImage.rendering === 'pixelated' &&
        this.$container.innerWidth() >= this.selectedImage.width
      ) {
        this.$image.addClass('pixelated');
      } else {
        this.$image.removeClass('pixelated');
      }
    }

    $('[data-image-id]', this.$container).attr(
      'data-image-id',
      this.selectedImage.id,
    );
  }
}

window.ngImageGallery = ngImageGallery;
