/*jshint esversion: 6 */

// FIXME - turn this into proper ES6 modules

// biome-ignore lint/correctness/noUnusedVariables: <accessed by external scripts>
let NgAudioPlayer;

// biome-ignore lint/correctness/noUnusedVariables: <accessed by external scripts>
let NgMediaPlayer;

(($) => {
  /**
   * There's an identical set of functions in ngutils, but
   * duplicating here removes the need to include ngutils
   * in the standalone player in embed
   */
  let auto_id = 0;

  const nextAutoId = () => {
    auto_id++;
    return `ng-media-autoid-${auto_id}`;
  };

  const idFor = ($element) => {
    let id = $element.attr('id');
    if (!id) {
      id = nextAutoId();
      $element.attr('id', id);
    }
    return id;
  };
  /**
   * Given an object and name of param, form a key as part of
   * of a combination of the pair of them.
   */
  const getStorageKey = (obj, name) => {
    return `${obj._name ? obj._name : 'NgMedia'}_${name}`;
  };

  /**
   * Attempt to get an item from local storage.
   */
  const getFromStorage = (obj, name, _def) => {
    const def = _def === undefined ? null : _def;

    try {
      const res = window.localStorage.getItem(getStorageKey(obj, name));

      if (null === res) {
        return def;
      }

      return res;
    } catch (_e) {
      return def;
    }
  };

  /**
   * Attempt to save an item to localStorage.
   */
  const saveToStorage = (obj, name, value) => {
    try {
      window.localStorage.setItem(getStorageKey(obj, name), value);
      return true;
    } catch (_e) {
      return false;
    }
  };

  const deleteFromStorage = (obj, name) => {
    try {
      window.localStorage.removeItem(getStorageKey(obj, name));
      return true;
    } catch (_e) {
      return false;
    }
  };

  /**
   * Gets a jQuery element from the controls we specify - e.g. play or pause buttons.
   */
  const getElement = (controls, param) => {
    if (!Object.prototype.hasOwnProperty.call(controls, param)) {
      return null;
    }

    const str_or_object = controls[param];

    if (null === str_or_object) {
      return null;
    }

    if (typeof str_or_object === 'string') {
      return $(str_or_object);
    }

    if (undefined === str_or_object) {
      return null;
    }

    return $(str_or_object);
  };

  /**
   * If not params have been explicitly specified, search for them
   * based on their id, WITHIN the player itself. So if you have a
   * player like:
   * <div id="player"><div id="player-progress"></div></div>
   *
   * And you're
   */
  const getPlayerElement = (controls, param, player) => {
    let el = getElement(controls, param);

    if (null !== el && el.exists()) {
      return el;
    }

    if (!player) {
      return null;
    }

    el = player.find(`[id$="-${param}"]`);

    if (el?.exists()) {
      return el;
    }

    return null;
  };

  /**
   * Plucks a param with the given name out of the param pool we've been passed.
   *
   */
  const getParam = (params, param, _default, existing) => {
    try {
      if (params !== undefined && params[param] !== undefined) {
        return params[param];
      }
      if (existing !== undefined && existing[param] !== undefined) {
        return existing[param];
      }

      if (_default === undefined) {
        return null;
      }

      return _default;
    } catch (_e) {
      return _default !== undefined ? _default : null;
    }
  };

  /**
   * Cribbed from video-js. Puts a time in seconds to 01:05:22, or whatever
   *
   * @return String
   */
  const formatTime = (actualSeconds, _guide) => {
    const guide = _guide === undefined ? actualSeconds : _guide;
    const seconds = actualSeconds < 0 ? 0 : actualSeconds;

    let s = Math.floor(seconds % 60);
    let m = Math.floor((seconds / 60) % 60);
    let h = Math.floor(seconds / 3600);
    const gm = Math.floor((guide / 60) % 60);
    const gh = Math.floor(guide / 3600);

    // handle invalid times
    if (Number.isNaN(seconds) || seconds === Number.POSITIVE_INFINITY) {
      // '-' is false for all relational operators (e.g. <, >=) so this setting
      // will add the minimum number of fields specified by the guide
      h = m = s = '-';
    }

    // Check if we need to show hours
    h = h > 0 || gh > 0 ? `${h}:` : '';

    // If hours are showing, we may need to add a leading zero.
    // Always show at least one digit of minutes.
    // updated to show leading 0 regardless (the || m < 10)
    m = `${((h || gm >= 10) && m < 10) || m < 10 ? `0${m}` : m}:`;

    // Check if leading zero is need for seconds
    s = s < 10 ? `0${s}` : s;

    return h + m + s;
  };

  const _NativeAudio = function ($element) {
    this.$element = $element;
    this.$element[0].load();

    this._duration = Number.NaN;

    $element[0].onloadedmetadata = () => {
      this._duration = $element[0].duration;
    };

    this.getSource = (index) => {
      const $sources = $('source', $element);

      if (!$sources.length) {
        throw 'No audio sources';
      }

      return $sources[index ? index : 0];
    };

    this.play = function (seconds) {
      if (undefined !== seconds) {
        this.seek(seconds);
      }

      this.$element[0].play();

      return this;
    };

    this.seek = function (seconds) {
      if (undefined === seconds || Number.isNaN(seconds)) {
        return this.$element[0].currentTime;
      }

      this.$element[0].currentTime = seconds;

      return this;
    };

    this.pause = function () {
      this.$element[0].pause();

      return this;
    };

    this.stop = function () {
      // pause, do not stop - else we lose the touch event
      const s = this.$element[0];
      s.pause();
      s.currentTime = 0;

      return this;
    };

    this.setVolume = function (volume) {
      this.$element[0].volume = volume;

      return this;
    };

    this.on = function (eventName, method) {
      if (eventName === 'load') {
        this.$element[0].addEventListener('loadedmetadata', method);
      }

      if (eventName === 'play') {
        this.$element[0].addEventListener('timeupdate', method);
      }

      if (eventName === 'end') {
        this.$element[0].addEventListener('ended', method);
      }
    };

    this.loaded = () => {
      return true;
    };

    this.duration = () => {
      return this._duration;
    };

    this.progress = () => {
      return this.seek();
    };

    this.volume = function (volume) {
      if (undefined === volume || Number.isNaN(volume)) {
        return this.$element[0].volume;
      }

      this.$element[0].volume = volume;
      return this;
    };

    this.unload = () => {
      console.log('Remove from sources?');
    };
  };

  /**
   * Wrapper for whatever player we're using. This could be
   * WaveSurfer, Howler, or Video Js, etc.
   *
   * The aim is to normalize method names across
   * any player we're using.
   *
   * All share some method names, like play(). However,
   * there is no skip forward for Howler, so we use seek()
   * as a method name, which calls Howler's seek and
   * WaveSurfer's skipForward(), etc.
   *
   */
  const Player = function (object, name) {
    this._player = null;
    this._progress = 0;
    this._playing = false;
    this._paused = false;
    this._muted = false;
    this._repeat = false;
    this._loop = false;

    // will be initialized by initControls
    // in the media player
    this._loaded = null;

    // fast forward and rewind go by this amount
    const SKIP_SECONDS = 2;

    // Howler, WaveSurfer, VideoJS (not yet implemented) etc.
    this.object = object;
    this._name = name || null;

    if (name === 'WaveSurfer') {
      object.on('ready', () => {
        this._loaded = true;
      });
    }

    this.isPlaying = function () {
      return true === this._playing;
    };

    this.isPaused = function () {
      return true === this._paused;
    };

    this.isMuted = function () {
      return true === this._muted;
    };

    this.isRepeating = function () {
      return true === this._repeat;
    };

    this.isLooped = function () {
      return true === this._loop;
    };

    this.mute = function () {
      return this.__exec('mute', true);
    };

    this.unmute = function () {
      return this.__exec('mute', false);
    };

    this.unload = function () {
      return this.__exec('unload');
    };

    /**
     * play media
     */
    this.play = function () {
      this._playing = true;
      this._paused = false;

      this.object.play();
    };

    /**
     * pause media
     */
    this.pause = function () {
      this._paused = true;
      this._playing = false;

      this._progress = this.getProgress();
      this.object.pause();
    };

    /**
     * stop media
     */
    this.stop = function () {
      this._paused = false;
      this._playing = false;

      this.object.stop();
    };

    /**
     * @return integer (seconds of media)
     */
    this.getDuration = function () {
      return this.__exec('duration');
    };

    /**
     * @return integer (seconds into progress of media)
     */
    this.getProgress = function () {
      return this.__exec('progress');
    };

    /**
     * Move forward SKIP_SECONDS at a time.
     */
    this.fastForward = function () {
      return this.__exec('fast_forward');
    };

    /**
     * Move backward SKIP_SECONDS at a time.
     */
    this.rewind = function () {
      return this.__exec('rewind');
    };

    this.seek = function (progress) {
      this._progress = progress;
      if (this._player?.saveProgress) {
        this._player.saveProgress(progress);
      }
      return this.__exec('seek', progress);
    };

    /**
     * Player values are typically 0.0 through 1.0
     */
    this.setVolume = function (level) {
      return this.__exec('volume', level / 100);
    };

    /**
     * @return boolean
     */
    this.isLoaded = function () {
      if (null === this._loaded) {
        this._loaded = false;
      }

      return this.__exec('loaded');
    };

    /**
     * Execute a method for the given player.
     * @param {string} name
     */
    this.__exec = function (name, value) {
      try {
        if (null === this._name) {
          throw 'Name not set.';
        }

        const fn = this.__getMapping()[this._name][name];

        if (typeof fn === 'string' || fn === undefined) {
          if (typeof this.object[fn] === 'function') {
            return this.object[fn](value);
          }

          if (typeof this.object[name] === 'function') {
            return this.object[name](value);
          }

          throw 'Cannot exec, fn is not recognized.';
        }

        if (typeof fn === 'function') {
          return fn(value);
        }
      } catch (e) {
        console.log(this.object);
        throw `Unable to get ${name}\n${e}`;
      }
    };

    this.__getMapping = function () {
      return {
        Howler: {
          loaded: () => {
            return this.object.state() === 'loaded';
          },
          progress: 'seek',
          fast_forward: () => {
            const progress = this.getProgress();
            let seek = 0;

            if (progress + SKIP_SECONDS < this.getDuration()) {
              seek = progress + SKIP_SECONDS;
            }

            return this.object.seek(seek);
          },
          rewind: () => {
            const progress = this.getProgress();
            let seek = 0;

            if (progress - SKIP_SECONDS > 0) {
              seek = progress - SKIP_SECONDS;
            }

            return this.object.seek(seek);
          },
        },
        NativeAudio: {},
        WaveSurfer: {
          duration: 'getDuration',
          mute: 'setMute',
          loaded: () => {
            return this._loaded;
          },
          progress: 'getCurrentTime',
          fast_forward: 'skipForward',
          rewind: 'skipBackward',
          seek: (val) => {
            return this.object.seekTo(val / this.object.getDuration());
          },
          unload: 'destroy',
          volume: (level) => {
            if (level === undefined) {
              return 1;
            }

            this.object.setVolume(level);
          },
        },
      };
    };
  };

  const MediaPlaylist = function (id) {
    MediaPlaylist.playlists.push(this);

    // id of the element this belongs to, or 'global'
    // for global player
    this._id = id;

    // should be either audio, or video
    this._type = null;

    // everything this playlist has
    this._items = [];
    this._loadMoreElem = null;

    // all items, but shuffled
    this._shuffled = [];
    this._shuffle = false;

    this._current_index = null;

    // when the playlist was started (for tracking time)
    this._startTime = new Date();

    // time in milliseconds before we ask if the user is still listening
    this._requireConfirmTime = 6 * 60 * 60 * 1000;

    // this is not a Player wrapper - it's either the NgAudioPlayer
    // or NgVideoPlayer instance
    this._player = null;

    this.setPlayer = function (player) {
      this._player = player;

      return this;
    };

    this.resetStartTime = function () {
      this._startTime = new Date();
    };

    this.checkContinue = function () {
      // check how long the playlist has been playing without any interaction
      const now = new Date();
      const diff = now - this._startTime;

      // if it's been playing too long, ask if the user is still listening before continuing
      if (diff > this._requireConfirmTime) {
        const adjective =
          this._player._type === 'audio' ? 'listening' : 'watching';
        const do_continue = confirm(`Are you still ${adjective}?`);
        this._startTime = new Date();
        return do_continue;
      }

      return true;
    };

    /**
     * Initialize the item when adding to the playlist.
     */
    this.addItem = function (item) {
      if (item.$element.attr('data-registered')) {
        return item;
      }

      item.$element.attr('data-registered', 1);
      item.initialize();

      item.$element.show();
      item.setPlaylist(this);

      // adds item into the playlist, which in turn controls
      // the player
      this._items.push(item);

      if (this._shuffle) {
        // reshuffle each time an item is added?
        this._doShuffle();
      }

      return this;
    };

    /**
     * @return boolean
     */
    this.isCurrentItem = function (item) {
      return this.getCurrentItem() === item;
    };

    /**
     * Clears all items from this playlist, resets
     * shuffle back to false?
     */
    this.clear = function () {
      this._items = [];
      this._shuffled = [];
      this._shuffle = false;
      this._current_index = 0;

      return this;
    };

    /**
     * @return []
     */
    this.getItems = function () {
      return this._items;
    };

    /**
     * Whether or not given MediaItem exists in the index already.
     *
     * @return boolean
     */
    this.itemIsIndexed = (item) => {
      const len = this._items.length;

      if (!len) {
        return false;
      }

      for (let i = 0; i < len; ++i) {
        if (this._items[i] === item) {
          return true;
        }
      }

      return false;
    };

    /**
     * @return [] shuffled items
     */
    this.getShuffled = function () {
      return this._shuffled;
    };

    this.hasCurrentItem = function () {
      return this.getCurrentItem() !== null;
    };

    this.getCurrentItem = function () {
      if (null === this._current_index) {
        return null;
      }

      if (this._items.length) {
        if (this._shuffle) {
          return this._shuffled[this._current_index];
        }

        return this._items[this._current_index];
      }

      return null;
    };

    /**
     * Given current item, extract its position in the relevant
     * array for the _current_index
     */
    this.setCurrentItem = function (item) {
      let i = 0;
      let items;
      let len;

      if (null === this._current_index) {
        this._current_index = 0;
      }

      if (this._shuffle) {
        items = this._shuffled;
      } else {
        items = this._items;
      }

      len = items.length;

      // if the item is a number, it must be within the
      // indices we have.
      if (typeof item === typeof 0) {
        if (item >= 0 && item < len) {
          return true;
        }

        return false;
      }

      for (i; i < len; ++i) {
        if (items[i] === item) {
          this._current_index = i;
          return true;
        }
      }

      // if the item isn't indexed, then add it...
      if (!this.itemIsIndexed(item)) {
        this.addItem(item);

        // only need to increment this if we have more than one item in the index
        if (this._items.length > 1) {
          this._current_index = this._items.length - 1;
        }
      }

      return false;
    };

    this._repeatingNotLooping = function () {
      if (this._player) {
        return this._player._repeat && !this._player._loop;
      }

      return false;
    };

    this._repeating = function () {
      if (this._player) {
        return this._player._repeat;
      }

      return false;
    };

    /**
     * Link an element that loads more items when scrolled on-screen.
     * We can auto-trigger this when a playlist gets close to the last item,
     * allowing it to keep playing without interruption.
     *
     * @param {jQuery} $element
     * @returns
     */
    this.setLoadMoreElement = function ($element) {
      // record the playlist id on the element so we can match it against event-driven updates
      $element.attr('data-ng-media-playlist', this._id);

      this._loadMoreElem = $element;
      return this;
    };

    /**
     * Playlists can call this to trigger the load more element and pull in more items
     */
    this.triggerLoadMoreElement = function () {
      // obviously we can't do anything if we don't have a load more element
      if (this._loadMoreElem) {
        // before we pull in new stuff from the server, let's listen for an event
        // that a new load more element might dispatch
        this.listenForNewLoadMoreElement();

        // trigger the load more element
        this._loadMoreElem.trigger('simulate-scroll-onscreen');
      }

      // at this point, we are done with this element, so we can let it go
      this._loadMoreElem = null;
    };

    /**
     * This will start listening for a new load more element to announce itself
     * (this is done in whatever partials or scripts handle popping in new content from the server)
     */
    this.listenForNewLoadMoreElement = () => {
      // prevent multiple listeners from being triggered
      ngutils.event.removeListener('media-loaded-more');

      // listen for the new load more element to announce itself
      ngutils.event.addListener('media-loaded-more', (data) => {
        // data.element should be a jquery dom element
        if (data.element?.length) {
          // set the new load more element so it can be triggered
          this.setLoadMoreElement(data.element);
        }

        // we don't need to listen for updates again until we've triggered the new load more element
        ngutils.event.removeListener('media-loaded-more');
      });
    };

    /**
     * Any action that triggers a "load more" element will trigger this listener
     * This could be the playlist nearing the end of its items, or by the infinite scroll updating
     *
     * This is triggered in the ngutils.element class when the 'whenOnScreen' event is triggered.
     */
    ngutils.event.addListener('ngutils.element.whenOnscreen', ($element) => {
      // compare the calling element to the one attached to this playlist
      if (
        this._loadMoreElem &&
        this._loadMoreElem.data('ng-media-playlist') ===
          $element.data('ng-media-playlist')
      ) {
        // if it is, we don't need to handle any more events from that specific element
        this._loadMoreElem = null;

        // we WILL, however, need to listen for any new 'load more' elements that may be added
        this.listenForNewLoadMoreElement();
      }
    });

    /**
     * Are there more items in this playlist to play?
     *
     * @return boolean
     */
    this.hasNextItem = function () {
      let len;
      if (this._shuffle) {
        len = this._shuffled.length;
      } else {
        len = this._items.length;
      }

      return this._current_index + 1 < len || this._repeating();
    };

    /**
     * Start playing the first item in the playlist
     * @param {function} afterCallback
     */
    this.playFirstItem = function (afterCallback) {
      this.resetStartTime();

      this._player._rewindNext = true;

      this._current_index = -1;
      this.loadNextItem(afterCallback);
    };

    /**
     * Loads data from the server used to play the next item in the playlist
     * @param {function} afterCallback
     * @returns
     */
    this.loadNextItem = function (afterCallback) {
      // check if we can continue playing (this may ask the user if they're still listening)
      if (!this.checkContinue()) {
        return false;
      }

      // can't do anything if we don't have any additional items
      if (!this.hasNextItem()) {
        return false;
      }

      // use the appropriate item array based on the shuffle setting
      const items = this._shuffle ? this._shuffled : this._items;

      // if we're not shuffling, and we're close to the end of the playlist, trigger any
      // load more elements that may be attached to the playlist
      if (!this._shuffle && this._current_index + 3 >= items.length) {
        this.triggerLoadMoreElement();
      }

      // get the next media object from the array and load it's meta data
      try {
        const n = items[this._current_index + 1];

        // handle the metadata nce loaded
        const callback = (response) => {
          n.onLoad(response);

          if (typeof afterCallback === 'function') {
            afterCallback(response);
          }
        };

        // do the loading
        n.load(callback);
      } catch (_e) {
        if (this._current_index) {
          // if we're here, we're probably out of bounds...
          /// so let's try loading the first item we have
          const n = items[0];
          const callback = (response) => {
            n.onLoad(response);

            if (typeof afterCallback === 'function') {
              afterCallback(response);
            }
          };

          n.load(callback);
        }
      }
    };

    /**
     * @return boolean
     */
    this.hasPreviousItem = function () {
      return this._current_index > 0 || this._repeating();
    };

    this.loadPreviousItem = function () {
      if (!this.hasPreviousItem()) {
        return false;
      }

      const items = this._shuffle ? this._shuffled : this._items;

      try {
        const n = items[this._current_index - 1];
        n.load(n.onLoad.bind(n));
      } catch (_e) {
        // if we're here, then the index is most likely
        // 0 (first item) already, in which case we'll want
        // to go to the last item we have.
        const n = items[items.length - 1];
        n.load(n.onLoad.bind(n));
      }
    };

    /**
     * Switches shuffle boolean on, takes items and puts them into random order.
     */
    this._doShuffle = function () {
      const fY = (array) => {
        let currentIndex = array.length;
        let temporaryValue;
        let randomIndex;

        // While there remain elements to shuffle...
        while (0 !== currentIndex) {
          // Pick a remaining element...
          randomIndex = Math.floor(Math.random() * currentIndex);
          currentIndex -= 1;

          // And swap it with the current element.
          temporaryValue = array[currentIndex];
          array[currentIndex] = array[randomIndex];
          array[randomIndex] = temporaryValue;
        }

        return array;
      };

      let temp;
      let temp2;

      this._shuffle = true;

      if (this.hasCurrentItem()) {
        temp = [];
        for (let i = 0, len = this._items.length; i < len; ++i) {
          if (this._items[i] !== this.getCurrentItem()) {
            temp.push(this._items[i]);
          }
        }

        if (temp.length) {
          temp = fY(temp);
        }
        temp2 = [this.getCurrentItem()].concat(temp);
        temp = temp2;

        // we want the item after the one that's already playing here
        this._current_index = 0;
      } else {
        temp = fY(this._items);

        // nothing was playing, set to 0
        this._current_index = 0;
      }

      this._shuffled = temp;

      return this;
    };

    /**
     * @return _doShuffle()
     */
    this.shuffleOn = function () {
      return this._doShuffle();
    };

    /**
     * Switch shuffled off, clear shuffled items.
     */
    this.shuffleOff = function () {
      this._shuffle = false;
      this._shuffled = [];

      return this;
    };

    this.toggleShuffle = function () {
      if (this._shuffle) {
        return this.shuffleOff();
      }

      return this.shuffleOn();
    };

    this.play = function (playItem, seconds) {
      // tell the player we're using this playlist
      this._player.setPlaylist(this);

      const current_item = this.getCurrentItem();
      const item = undefined === playItem ? current_item : playItem;

      const all_items = this.getItems();

      for (let i = 0, len = all_items.length; i < len; ++i) {
        if (all_items[i] !== item) {
          all_items[i].$element.removeClass('playing paused');
        }
      }

      if (this._player) {
        if (current_item !== item) {
          this.setCurrentItem(item);
          this._player.initPlayer();
        }

        this._player.play(seconds);

        return this;
      }

      throw 'Unable to play.';
    };

    this.pause = function () {
      if (this._player) {
        this._player.pause();
        return this;
      }

      throw 'Unable to pause';
    };
  };

  // contains ALL playlists
  MediaPlaylist.playlists = [];

  const AudioPlaylist = function (_id, ...args) {
    MediaPlaylist.apply(this, [_id, ...args]);

    this._type = 'audio';
  };

  const MediaItem = function (element_or_params) {
    // audio, or video
    this._type = null;

    // e.g. ['mp3'] or ['mp4']
    this._qualities = null;

    // matches the id of the submission or project itself
    this._generic_id = null;

    // type id should match ContentType of AUDIO, AUDIO_PROJECT, MOVIE
    // or MOVIE_PROJECT
    this._type_id = null;

    // the playlist that this belongs to, if any
    this._playlist = null;

    // the player in which this belongs
    this._player = null;

    this._sources = {};

    let $element = null;
    if (typeof element_or_params === typeof '') {
      $element = $(element_or_params);
      this._generic_id = $element.attr('data-audio-playback');
    } else if (typeof element_or_params === typeof {}) {
      if (element_or_params.container) {
        // this is most likely a
        if (typeof element_or_params.container === typeof '') {
          $element = $(element_or_params.container);
        } else {
          $element = element_or_params.container;
        }

        const p = element_or_params;
        this._generic_id = p.generic_id || null;
        this._type_id = p.type_id || null;
      } else if ($.isFunction(element_or_params.exists)) {
        $element = element_or_params;
      }
    }

    if (null === $element) {
      throw 'Invalid/missing element.';
    }

    // should return #container for the listen page, auto assigned
    // for other pages that don't explicitly set the id="" attribute
    this._id = idFor($element);

    this.$element = $element;

    this.initialize = function () {
      this.$element.off().on('click', () => {
        this.onClick(this);
      });

      return this;
    };

    this.setPlaylist = function (playlist) {
      this._playlist = playlist;

      return this;
    };

    this.setPlayer = function (player) {
      this._player = player;

      return this;
    };

    /**
     * These are html5 media sources.
     */
    this.addSource = function (src, type, audioQuality) {
      const quality =
        audioQuality === undefined ? this._qualities[0] : audioQuality;

      if (this._qualities.indexOf(quality) === -1) {
        if (null === this._qualities) {
          throw `Invalid/missing quality ${quality}`;
        }
      }

      if (this._sources[quality] === undefined) {
        this._sources[quality] = [];
      }

      this._sources[quality].push({
        src: src,
        type: type,
      });

      return this;
    };

    this.getSources = function () {
      return this._sources;
    };

    this.isPlaying = function () {
      return this.$element.hasClass('playing');
    };

    this.isPaused = function () {
      return this.$element.hasClass('paused');
    };

    this.play = function (triggerPlaylist) {
      if (!this.$element.is('a')) {
        return this;
      }

      this.$element.removeClass('playing paused').addClass('playing');

      const trigger_playlist =
        undefined === triggerPlaylist ? true : triggerPlaylist;

      if (trigger_playlist) {
        // this in turn, triggers the player. We only want to do this if
        // we clicked from the item itself, and not from the player
        this._playlist.play(this);
      }

      return this;
    };

    this.pause = function (triggerPlaylist) {
      if (!this.$element.is('a')) {
        return this;
      }

      this.$element.removeClass('playing paused').addClass('paused');

      const trigger_playlist =
        undefined === triggerPlaylist ? true : triggerPlaylist;

      if (trigger_playlist) {
        // this in turn, triggers the player. We only want to do this if
        // we clicked from the item itself
        this._playlist.pause();
      }

      return this;
    };

    // there are no playlist controls from the item itself -
    // it can either play or pause, that's it. This is an instruction
    // from the player - the person clicked stop from there
    this.stop = function () {
      if (!this.$element.is('a')) {
        return this;
      }

      this.$element.removeClass('playing paused');

      return this;
    };

    this.load = () => {
      throw 'Please implement load for this item.';
    };
  };

  const AudioItem = function (params, ...args) {
    MediaItem.apply(this, [params, ...args]);

    this._type = 'audio';
    this._qualities = ['mp3'];
    this._generic_id = null;
    this._type_id = null;

    // we are getting meta data from the embed tag
    if (this.$element.attr('data-audio-playback')) {
      this._generic_id = this.$element.attr('data-audio-playback');
      this._type_id = this.$element.attr('data-audio-type');

      // meta data was passed in params
    } else if (params.generic_id !== undefined) {
      this._generic_id = params.generic_id;
      this._type_id = params.type_id;
    }

    /**
     * @param {integer} generic_id
     * @param {integer} type_id
     * @param {Object} callback
     */
    this.load = function (callback) {
      const base_url = '/audio/load';

      const generic_id = this._generic_id;
      let type_id = this._type_id;

      const url_parts = [base_url, generic_id];
      type_id = type_id !== undefined && null !== type_id ? type_id : null;

      if (type_id) {
        url_parts.push(type_id);
      }

      const data = PHP.get('ismobile') ? { isMobile: true } : {};

      this._sources = {};

      try {
        //this._player.play().stop();
      } catch (_e) {}

      $.get(url_parts.join('/'), data, (response) => {
        if (response?.sources && response?.html) {
          for (let i = 0, len = response.sources.length; i < len; ++i) {
            this.addSource(response.sources[i].src, response.sources[i].type);
          }

          ngutils.event.dispatch('playlist-item-started', response);

          // this is most likely a result of an AudioActions::load()
          // request, make this the current playing item etc
          if (typeof callback === 'function') {
            callback(response);
          }
        }
      }).fail((_response) => {
        alert("Sorry, we couldn't load that item.");
      });
    };

    return this;
  };

  AudioItem.prototype.onLoad = function (response) {
    const element = this.$element;
    const player = this._player;
    const player_object = player._player_object || null;

    element.addClass('playing');

    this._generic_id = response.id;
    this._type_id = response.type_id;

    if (
      player_object &&
      (player_object.isPlaying() || player_object.isPaused())
    ) {
      player.saveProgress();
      player_object.stop();
    }

    // push the author information into the player.
    // this includes the favorite button.
    if (player._author_display) {
      $(player._author_display).html(response.html);
    }

    player._params.duration = response.duration;

    // reinitialize container
    player.initContainer();

    this.play();

    return this;
  };

  AudioItem.prototype.onClick = function (_response) {
    const element = this.$element;

    if (this._playlist) this._playlist.resetStartTime();

    // do nothing, this isn't a clickable element
    if (!element.is('a')) {
      return this;
    }

    if (this.isPlaying()) {
      this.pause(true);
      return this;
    }

    if (this.isPaused()) {
      this.play(true);
      return this;
    }

    this._player.initForAsync(() => {
      this.load(this.onLoad.bind(this));
    });

    return this;
  };

  const _NgMediaPlayer = function (id, params) {
    this._name = null;
    this._type = null;

    this._initialized = false;

    // controls for the player itself... play, skip, whatever
    this._controls = params.controls || {};

    // contains  things such as the generic and type id, the URL of the file to play
    // etc.
    this._params = params.params || {};

    // misc. params - including the loading div, whether or not to loop, and the peaks
    // if they've already been saved
    this._player_params = params.player_params || {};

    // whichever player we're using
    this._player_object = null;

    // all players we have
    _NgMediaPlayer.players.push(this);

    // this is to be overwritten in child classes. E.g. ['mp3']
    this._qualities = null;

    this._wait_for_async = PHP.get('ismobile');

    // these are not playlists in the sense of newgrounds.com/playlists
    // - they're items within the current scope of the player
    this._playlists = {};
    this._current_playlist = null;

    // for the current file itself
    this._generic_id = getParam(this._params, 'generic_id');
    this._type_id = getParam(this._params, 'type_id');
    this._url = getParam(this._params, 'url');

    // vars for the state of the item itself
    this._loop = getParam(this._params, 'loop', false);
    // this is for players with multiple items - whether
    // or not we're going back to the beginning of
    // the playlist once the last item is done playing
    // if _loop is set, then this MUST be true
    this._repeat = getParam(this._params, 'repeat', this._loop);

    // if this is set to true, when a new song starts it will ignore any saved progress and rewind to the beginning
    // used when skipping to the next song in a list
    this._rewindNext = false;

    this._muted = getParam(this._player_params, 'muted', false);

    this._standalone = getParam(this._player_params, 'standalone', true);

    this._volume_settable = getParam(
      this._player_params,
      'volume_settable',
      true,
    );

    // the actual timings of
    this._duration = 0;
    this._progress = 0;

    this._volume = 100;

    // in listen view, we don't use this - clicking the waveform
    // puts the track at that position
    this._use_progress_scrubber = getParam(
      this._player_params,
      'use_progress_scrubber',
      true,
    );

    this._can_play = true;

    // this is the main wrapper element
    this.$element = $(`#${id}`);

    // this is the audio waveform or progress bar
    this.$container = getPlayerElement(
      this._player_params,
      'container',
      this.$element,
    );

    // display elements for duration and the progress of the track (their
    // times, not the physical progress of the bar/waveform)
    this.$duration = getPlayerElement(
      this._player_params,
      'duration',
      this.$element,
    );
    this.$progress = getPlayerElement(
      this._player_params,
      'progress',
      this.$element,
    );

    // this is an element, rather than a var
    this.$loading = getElement(this._player_params, 'loading');

    // all elements, but they're controls for the playback of the item
    // these are in the order they appear onscreen

    this.$previous = getPlayerElement(this._controls, 'previous');
    this.$rewind = getPlayerElement(this._controls, 'rewind');
    this.$play = getPlayerElement(this._controls, 'play');
    this.$pause = getPlayerElement(this._controls, 'pause');
    this.$stop = getPlayerElement(this._controls, 'stop');
    this.$fastForward = getPlayerElement(this._controls, 'fastForward');
    this.$next = getPlayerElement(this._controls, 'next');

    this.$shuffle = getPlayerElement(this._controls, 'shuffle');
    this.$loop = getPlayerElement(this._controls, 'loop');
    this.$repeat = getPlayerElement(this._controls, 'repeat');

    this.$soundOff = getPlayerElement(this._controls, 'soundOff');
    this.$soundOn = getPlayerElement(this._controls, 'soundOn');

    // slider, if present - which it isn't, in mobile versions
    this.$volume = getPlayerElement(this._controls, 'volume');

    // show/hide the slider, not always present (e.g. mobile)
    this.$volumeToggle = getPlayerElement(this._controls, 'volumeToggle');

    /**
     * this doesn't do anything particularly useful, other than to
     * get all of the elements that control playback (e.g. play, pause)
     * into one array that can be looped through in a $.each
     * to enable/disable
     */
    this.$controls = [];

    this.setPlaylist = function (playlist) {
      // add this, if it's not already there
      this.addPlaylist(playlist);

      // and then set it to the current playlist
      this._current_playlist = playlist;

      // add ourselves as the player for the playlist
      playlist.setPlayer(this);

      return this;
    };

    this.playlistIsCurrent = function (playlist) {
      return playlist === this._current_playlist;
    };

    this.playlistInLists = function (playlist) {
      for (const n of Object.keys(this._playlists)) {
        if (this._playlists[n] === playlist) {
          return true;
        }
      }

      return false;
    };

    this.startPlaylist = function (playlistId) {
      const playlist_id =
        playlistId === undefined ? this._current_playlist._id : playlistId;
      this._playlists[playlist_id].playFirstItem();
    };

    this.addPlaylist = function (playlist) {
      if (!this.playlistInLists(playlist)) {
        this._playlists[playlist._id] = playlist;
      }

      const len = $.map(this._playlists, (_n, i) => {
        return i;
      }).length;

      if (len === 1) {
        this._current_playlist = playlist;
      }

      return this;
    };

    this.getPlaylist = function (id) {
      return this._playlists[id] !== undefined ? this._playlists[id] : null;
    };

    this.removePlaylist = function (playlist_or_playlistName) {
      const playlist =
        typeof playlist_or_playlistName === 'string'
          ? this.getPlaylist(playlist_or_playlistName)
          : playlist_or_playlistName;

      if (playlist) {
        delete this._playlists[playlist._id];
      }
    };

    this.emptyPlaylist = function (playlist_or_playlistName) {
      const playlist =
        typeof playlist_or_playlistName === 'string'
          ? this.getPlaylist(playlist_or_playlistName)
          : playlist_or_playlistName;

      if (playlist) {
        playlist.clear();
      }
    };

    this.getFromStorage = function (param, def) {
      return getFromStorage(this, param, def);
    };

    this.saveToStorage = function (name, value) {
      return saveToStorage(this, name, value);
    };

    this.deleteFromStorage = function (name) {
      return deleteFromStorage(this, name);
    };

    this.activate = function () {
      if (this.$element) {
        if (!this.$element.hasClass('active')) {
          this.$element.addClass('active');
        }
      }

      return this;
    };

    this.deActivate = function () {
      if (this.$element?.hasClass('active')) {
        this.$element.removeClass('active');
      }

      if (this._player_object) {
        // stop any playback
        this._player_object.stop();
      }

      return this;
    };

    /**
     * @return {float} duration (in seconds)
     */
    this.getDuration = function () {
      if (this._params.duration) {
        return this._params.duration;
      }

      // fallback to this if we haven't yet got the duration
      if (this._player_object) {
        const d = this._player_object.getDuration();
        if (!Number.isNaN(d) && d) {
          return d;
        }
      }
    };

    this.getPlayerObject = function () {
      if (!this._player_object) {
        throw 'No player object set.';
      }

      return this._player_object;
    };

    /**
     * @return {float} progress (in seconds)
     *
     */
    this.getProgress = function () {
      if (this._player_object) {
        return this._player_object.getProgress();
      }
    };

    /**
     * Turn sound off.
     */
    this.mute = function () {
      if (this._player_object) {
        this._player_object.mute();
      }

      this._muted = true;

      if (this.$soundOn) {
        this.$soundOn.show();
      }

      if (this.$soundOff) {
        this.$soundOff.hide();
      }

      return this;
    };

    /**
     * Turn sound back on again.
     */
    this.unmute = function () {
      if (this._player_object) {
        this._player_object.unmute();
      }

      this._muted = false;

      if (this.$soundOn) {
        this.$soundOn.hide();
      }

      if (this.$soundOff) {
        this.$soundOff.show();
      }

      return this;
    };

    this.previous = function () {
      if (!this._current_playlist) {
        return false;
      }

      this._current_playlist.loadPreviousItem();

      return this;
    };

    /**
     * @param {float} seconds
     *
     * Play the current item, optionally from seconds
     */
    this.play = function (seconds) {
      if (!this._standalone) {
        this.activate();
      }

      if (this._player_object) {
        // Howler's method for play differs to that of
        // WaveSurfer - WS takes seconds as a param, and starts
        // from there when it's present. Howler takes
        // a sprite/id for its first argument and plays that clip.
        if (seconds !== undefined) {
          this._player_object.seek(seconds);
        }

        // howler also seems to be responsible for the 'Uncaught (in promise) AbortError: The play() request was interrupted by a call to pause().' message in the dev console here
        this._player_object.play();
      }

      //
      this.updateButtons();

      this.initPlaybackInfo();

      // stop other players
      this.stopOtherPlayers();

      // indicate the change on the media item, if there is one
      if (this._current_playlist) {
        const current_item = this._current_playlist.getCurrentItem();

        if (current_item) {
          current_item.play(false);
        }
      }

      return this;
    };

    /**
     * Pauses playback, hides pause button.
     * Also makes a note of any progress in the track, so that
     * if the user returns to this at a later date, it'll continue
     * playback from that point.
     */
    this.pause = function () {
      if (this._player_object) {
        this._player_object.pause();
      }

      if (this._current_playlist?.getCurrentItem()) {
        this._current_playlist.getCurrentItem().pause(false);
      }

      this.updateButtons();
      this.saveProgress();
      this.trackProgress();

      return this;
    };

    /**
     * Stop playback, reset controls.
     * When a track ends, it calls this method. But we don't necessarily
     * want to hide the player UNLESS we've reached the last item in those
     * cases.
     */
    this.stop = function (deactivatePlayer) {
      // if not explicitly passed, only deactivate if
      // this track does not have a next item
      const deactivate =
        undefined === deactivatePlayer
          ? this._standalone || !this.hasNextItem()
          : deactivatePlayer;

      if (this._player_object) {
        this._player_object.stop();
      }

      if (this.$stop) {
        this.$stop.disable();
      }

      if (this.$play) {
        this.$play.show();
        this.$play.enable();
      }

      if (this.$pause) {
        this.$pause.hide();
      }

      if (this._current_playlist?.getCurrentItem()) {
        this._current_playlist.getCurrentItem().stop();
      }

      this.updateButtons();
      this.initPlaybackInfo();

      if (deactivate) {
        this.deActivate();
      }

      return this;
    };

    /**
     * Skips player forward SKIP_SECONDS at a time.
     */
    this.fastForward = function () {
      if (this._player_object) {
        this._player_object.fastForward();
        this.trackProgress();
      }

      return this;
    };

    this.next = function () {
      if (!this._current_playlist) {
        return this;
      }

      this.saveProgress();
      this._rewindNext = true;
      this._current_playlist.loadNextItem();

      return this;
    };

    /**
     * Skips player back SKIP_SECONDS at a time.
     */
    this.rewind = function () {
      if (this._player_object) {
        this._player_object.rewind();
        this.trackProgress();
      }

      return this;
    };

    /**
     * Move to a certain point in the track.
     */
    this.seek = function (time) {
      if (this._player_object) {
        this._player_object.seek(time);
      }

      if (this.$progress) {
        this.$progress.html(formatTime(time));
      }

      this.saveProgress(time);

      return this;
    };

    this.skipBack = function () {
      if (this._player_object) {
        this._player_object.skipBack();
      }

      return this;
    };

    this.skipForward = function () {
      if (this._player_object) {
        this._player_object.skipForward();
      }

      return this;
    };

    /**
     * Move the volume up and down.
     * By default, the slider will change the volume as the
     * user moves it. When they let go of the handle, the level
     * will be stored, so that it's persistent across sessions.
     * Icon should change to various states according to the level.
     */
    this.setVolume = function (percentage, store) {
      if (this._player_object && !Number.isNaN(percentage)) {
        this._volume = percentage;
        this._player_object.setVolume(percentage);
      }

      if (this.$volumeToggle) {
        const ti = this.$volumeToggle.find('i');

        if (0 === percentage) {
          ti.removeClass().addClass('fa fa-volume-off');
        } else if (percentage <= 50) {
          ti.removeClass().addClass('fa fa-volume-down');
        } else {
          ti.removeClass().addClass('fa fa-volume-up');
        }
      }

      if (store) {
        this.saveToStorage('volume', percentage);
      }

      return this;
    };

    /**
     * @param {float} progress (in seconds)
     *
     * Store the progress of the track in localStorage
     */
    this.saveProgress = function (progressValue) {
      const progress =
        progressValue === undefined ? this.getProgress() : progressValue;

      const playlist = this._current_playlist;

      if (
        (false === progress || !Number.isNaN(progress)) &&
        playlist &&
        playlist.getCurrentItem()
      ) {
        const c = playlist.getCurrentItem();
        const k = `${c._generic_id}_${c._type_id}`;
        const key = `${k}_progress`;

        if (false === progress) {
          this.deleteFromStorage(key);
        } else {
          this.saveToStorage(key, progress);
        }
      }
    };

    /**
     * Set player to repeat - not loop, but repeat the
     * playlist once it's reached the end of the queue.
     */
    this.repeat = function () {
      const p = this._player_object || {};

      if (this._repeat) {
        // we're already repeating, now should we be looping?
        if (this._loop) {
          // nope, we're at the end of the line here...
          // turn off repeat and loop
          this._repeat = false;
          this._loop = false;
        } else {
          // yes, we should be looping
          this._loop = true;
        }
      } else {
        // only one track per player here, skip straight to looping
        if (this._standalone) {
          this._loop = true;
        } else {
          this._loop = false;
        }
        this._repeat = true;
      }

      p._repeat = this._repeat;
      p._loop = this._loop;

      this.updateButtons();

      return this;
    };

    this.shuffle = function () {
      this._shuffle = !this._shuffle;
      this.updateButtons();

      const p = this._current_playlist;

      if (p) {
        if (this._shuffle) {
          p.shuffleOn();
        } else {
          p.shuffleOff();
        }
      }

      return this;
    };

    /**
     * Alias
     * Add an item to the playlist the player is running through.
     */
    this.addItem = function (mediaItem, targetPlaylist) {
      const item =
        typeof mediaItem === 'string'
          ? new AudioItem($(`#${mediaItem}`))
          : mediaItem;

      const playlist = this._current_playlist || targetPlaylist;

      if (playlist === undefined || null === playlist) {
        throw 'Missing playlist!';
      }

      // the item will be pushed into the
      playlist.addItem(item);

      // assign player to this
      item.setPlayer(this);

      return this;
    };

    this.setCurrentItem = function (item_pos_or_object) {
      if (this._current_playlist) {
        this._current_playlist.setCurrentItem(item_pos_or_object);
      }

      return this;
    };

    /**
     * Alias.
     * Whether or not there's an item before this in the queue to play.
     */
    this.hasPreviousItem = function () {
      if (null === this._current_playlist) {
        return false;
      }

      return this._current_playlist.hasPreviousItem();
    };

    /**
     * Alias.
     * Whether or not there is another track to play after the one that's
     * currently playing.
     */
    this.hasNextItem = function () {
      if (this._current_playlist === null) {
        return false;
      }

      return this._current_playlist.hasNextItem();
    };

    /**
     * Make an AJAX request to get the details of the next item.
     */
    this.loadNextItem = function (callback) {
      if (this._current_playlist) {
        this._current_playlist.loadNextItem(callback);
      }
    };

    /**
     * Add some handlers for keyboard inputs
     */
    window.addEventListener('keydown', (e) => {
      // The user might be focused on something where they need to be able to type.
      // Check these element types, and if the user is focused on one, just return without doing anything
      if (
        document.activeElement &&
        (document.activeElement.tagName === 'INPUT' ||
          document.activeElement.tagName === 'TEXTAREA' ||
          document.activeElement.tagName === 'CANVAS' ||
          document.activeElement.isContentEditable)
      ) {
        return;
      }

      // If the media isn't playing, we don't want to do anything
      if (this.isPlaying()) {
        // if we are in a playlist with more than one item, let the user switch tracks with the arrow keys
        if (e.key === 'ArrowRight' && this._current_playlist?.hasNextItem()) {
          e.preventDefault();
          e.stopPropagation();
          this.next();
        } else if (
          e.key === 'ArrowLeft' &&
          this._current_playlist?.hasPreviousItem()
        ) {
          e.preventDefault();
          e.stopPropagation();
          this.previous();
        }
        // if the user pushes a number key, jump to that percentage of the track
        else {
          const numKeys = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
          if (numKeys.includes(e.key)) {
            const percent = Number.parseInt(e.key) * 10;
            this.seek((this.getDuration() * percent) / 100);
          }
        }
      }
    });

    /**
     * On completion of the playing track, do one of the following:
     * 1. If looping, go back to the beginning of the track.
     * 2. If there are more items in the list, play the next one.
     * 3. If this was the last item in a repeating playlist, play the first item.
     * 4. Stop.
     */
    this.onEnd = () => {
      // clear any progress we'd saved for this
      this.saveProgress(false);

      if (this._loop) {
        return this.play(0);
      }

      if (this.hasNextItem()) {
        this.stop(false);
        this._rewindNext = true;
        return this.loadNextItem(this.updateButtons.bind(this));
      }

      if (this._repeat) {
        this.setCurrentItem(0).seek(0).play();
        return this.updateButtons();
      }

      this.stop(true);
      return this.updateButtons();
    };

    /**
     * Change the states of all of the control buttons for the player, depending
     * on what action is currently performing, if any.
     */
    this.updateButtons = function () {
      const getObject = (name) => {
        if (
          Object.prototype.hasOwnProperty.call(this, name) &&
          null !== this[name]
        ) {
          return this[name];
        }

        return null;
      };

      // small internal utility functions to hide/show, disable
      // and enable elements
      const enableDisableElement = (name, disabled) => {
        const o = getObject(name);

        if (o) {
          o.prop('disabled', disabled);
        }

        return o;
      };

      const enableElement = (name) => {
        return enableDisableElement(name, false);
      };

      const disableElement = (name) => {
        return enableDisableElement(name, true);
      };

      const showHideElement = (name, show, className, removeClassName) => {
        const o = getObject(name);

        if (o) {
          if (show) {
            o.show();
          } else {
            o.hide();
          }

          if (className) {
            o.addClass(className);
          }

          if (removeClassName) {
            o.removeClass(removeClassName);
          }
        }

        return o;
      };

      const showElement = (name, className, removeClassName) => {
        return showHideElement(name, true, className, removeClassName);
      };

      const hideElement = (name, className, removeClassName) => {
        return showHideElement(name, false, className, removeClassName);
      };

      const setTitle = (name, title) => {
        const o = getObject(name);

        if (o) {
          o.attr('title', title);
        }

        return o;
      };

      // enable all controls to start with
      $.each(this.$controls, function () {
        $(this).enable();
      });

      // when playing, enable and show stop and pause buttons and
      // hide play
      if (this.isPlaying()) {
        showElement('$pause', 'active');
        hideElement('$play');
        enableElement('$stop');
      } else {
        hideElement('$pause', null, 'active');
        showElement('$play');

        // when neither playing nor paused, stop isn't available
        if (!this.isPaused()) {
          disableElement('$stop');
        }
      }

      if (!this.hasPreviousItem()) {
        disableElement('$previous');
      }

      if (!this.hasNextItem()) {
        disableElement('$next');
      }

      // same with sound
      showHideElement('$soundOn', this._muted);
      showHideElement('$soundOff', !this._muted);

      //and with loops
      if (this._repeat) {
        let c = 'active';
        let title;
        if (this._loop) {
          c = `${c} repeat-once`;
          title = 'Repeat one';
        } else {
          title = 'Repeat all';
        }

        showElement('$repeat', c);
        setTitle('$repeat', title);
      } else {
        showElement('$repeat', null, 'active repeat-once');
        setTitle('$repeat', 'Repeat all');
      }

      if (this._shuffle) {
        showElement('$shuffle', 'active');
      } else {
        showElement('$shuffle', null, 'active');
      }

      return this;
    };

    /**
     * Fire this to change the current runtime of the media being played.
     */
    this.updateProgress = function (newProgress) {
      let progress = newProgress;

      if (this.$progress?.exists()) {
        if (progress === undefined) {
          if (this._player_object) {
            progress = this._player_object.getProgress();
          }
        }

        if (Number.isNaN(progress)) {
          progress = 0;
        }

        this.$progress.html(formatTime(progress));
      }

      return this;
    };

    /**
     * Sets initial playback time to
     */
    this.initPlaybackInfo = function () {
      if (this.$duration) {
        this.$duration.html(formatTime(this.getDuration()));
      }

      // any progress that's been made
      this.updateProgress();
    };

    /**
     * alias
     */
    this.isPlaying = function () {
      try {
        return this._player_object.isPlaying();
      } catch (_e) {
        return false;
      }
    };

    /**
     * alias
     */
    this.isPaused = function () {
      try {
        return this._player_object.isPaused();
      } catch (_e) {
        return false;
      }
    };

    /**
     * If for some reason we have more than one player, stop
     * playback on other players.
     */
    this.stopOtherPlayers = function () {
      let player;

      if (_NgMediaPlayer.players.length > 1) {
        for (let i = 0, len = _NgMediaPlayer.players.length; i < len; ++i) {
          player = _NgMediaPlayer.players[i];

          if (player !== this) {
            player.stop();
          }
        }
      }

      return this;
    };

    /**
     * Designed to be called when the player is ready.
     */
    this.initControls = function () {
      let control;

      for (const n of Object.keys(this._controls)) {
        control = `$${n}`;
        if (Object.prototype.hasOwnProperty.call(this, control)) {
          this.$controls.push(this[control]);
        }
      }

      if (this.$previous && this.hasPreviousItem()) {
        this.$previous.off().on('click', () => {
          if (this._current_playlist) this._current_playlist.resetStartTime();
          this.previous();
          return false;
        });
      }

      this.$play.off().on('click', () => {
        if (this._current_playlist) this._current_playlist.resetStartTime();
        this.play();

        return false;
      });

      this.$pause.off().on('click', () => {
        if (this._current_playlist) this._current_playlist.resetStartTime();
        this.pause();

        return false;
      });

      // not present on mobile
      if (this.$stop) {
        this.$stop.off().on('click', () => {
          if (this._current_playlist) this._current_playlist.resetStartTime();
          this.stop(true);
          return false;
        });
      }

      if (this.$shuffle) {
        this.$shuffle.off().on('click', () => {
          if (this._current_playlist) this._current_playlist.resetStartTime();
          this.shuffle();
          return false;
        });
      }

      if (this.$repeat) {
        this.$repeat.off().on('click', () => {
          if (this._current_playlist) this._current_playlist.resetStartTime();
          this.repeat();
          return false;
        });
      }

      /**
       * Mobile only. Turn the sound off.
       */
      if (this.$soundOff) {
        this.$soundOff.off().on('click', () => {
          if (this._current_playlist) this._current_playlist.resetStartTime();
          this.mute();
          return false;
        });
      }

      /**
       * Mobile only. Turn the sound on.
       */
      if (this.$soundOn) {
        this.$soundOn.off().on('click', () => {
          if (this._current_playlist) this._current_playlist.resetStartTime();
          this.unmute();
          return false;
        });
      }

      if (this.$fastForward) {
        this.$fastForward.off().on('click', () => {
          if (this._current_playlist) this._current_playlist.resetStartTime();
          this.fastForward();
          return false;
        });
      }

      if (this.$next && this.hasNextItem()) {
        this.$next.off().on('click', () => {
          if (this._current_playlist) this._current_playlist.resetStartTime();
          this.next();
          return false;
        });
      }

      if (this.$rewind) {
        this.$rewind.off().on('click', () => {
          if (this._current_playlist) this._current_playlist.resetStartTime();
          this.rewind();
          return false;
        });
      }

      if (this.$skipBack) {
        this.$skipBack.off().on('click', () => {
          if (this._current_playlist) this._current_playlist.resetStartTime();
          this.skipBackward();
          return false;
        });
      }

      if (this.$skipForward) {
        this.$skipForward.off().on('click', () => {
          if (this._current_playlist) this._current_playlist.resetStartTime();
          this.skipForward();

          return false;
        });
      }

      // set the initial volume to whatever it was before
      // we need this value for the slider, also
      if (this._volume_settable) {
        const volumeLevel = Number.parseInt(
          this.getFromStorage('volume', 100),
          10,
        );
        this.setVolume(volumeLevel);

        if (this.$volumeToggle && this.$volume) {
          const showSlider = () => {
            this.$volume.removeClass('off');
          };

          const hideSlider = () => {
            this.$volume.addClass('off');
          };

          this.$volume.slider({
            orientation: 'vertical',
            step: 1,
            value: volumeLevel,
            // this is critical in terms of getting the
            // fill color in the slider
            range: 'min',
            min: 0,
            max: 100,
            slide: (_event, ui) => {
              this.setVolume(ui.value);
            },
            change: (_event, ui) => {
              this.setVolume(ui.value, true);
            },
            stop: hideSlider,
          });

          this.$volumeToggle.off().on('click', () => {
            if (this._current_playlist) this._current_playlist.resetStartTime();
            if (this.$volume.hasClass('off')) {
              showSlider();
            } else {
              hideSlider();
            }

            return false;
          });
        }
      }

      if (this.$loading) {
        this.$loading.remove();
      }

      const p = this._current_playlist;
      const c = p ? p.getCurrentItem() : null;

      if (c?._generic_id && c?._type_id) {
        const k = `${c._generic_id}_${c._type_id}`;
        let progress = 0;

        // if this is set to true, when a new song starts it will ignore any saved progress and rewind to the beginning
        // used when skipping to the next song in a list
        if (this._rewindNext) {
          // remove the recorded progress
          this.deleteFromStorage(`${k}_progress`);
          this._rewindNext = false;
        } else {
          progress = this.getFromStorage(`${k}_progress`);
        }

        if (progress && !Number.isNaN(progress)) {
          const duration = this.getDuration();

          // arbitrary value as a default
          let remaining_time = 99;
          if (duration && !Number.isNaN(duration)) {
            remaining_time = duration - progress;
          }

          // if there's less than 10 seconds left, treat it as if they finished listening previously
          if (remaining_time > 10) this.seek(progress);
        }
      }

      this.updateButtons();
      this.initPlaybackInfo();

      return this;
    };

    this.volumeScrollWheelHandler = function (event) {
      if (this._volume_settable) {
        if (this.$volume.hasClass('off')) {
          return;
        }

        let delta = 0;

        if (event.originalEvent.wheelDelta) {
          delta = event.originalEvent.wheelDelta;
        } else if (event.originalEvent.detail) {
          delta = -event.originalEvent.detail;
        }

        let volume = this._volume;

        if (delta > 0) {
          volume += 10;
          if (volume > 100) volume = 100;
          this.$volume.slider('value', volume);
        } else if (delta < 0) {
          volume -= 10;
          if (volume < 0) volume = 0;
          this.$volume.slider('value', volume);
        } else {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
      }
    };

    // add scroll wheel listener for above function
    this.$element.on(
      'mousewheel DOMMouseScroll',
      this.volumeScrollWheelHandler.bind(this),
    );

    return this;
  };

  _NgMediaPlayer.players = [];

  const _NgAudioPlayer = function (_id, _audioParams, ...args) {
    _NgMediaPlayer.apply(this, [_id, _audioParams, ...args]);

    this.ready = false;

    this._name = 'NgAudioPlayer';
    this._type = 'audio';

    this._howler = null;

    this.updateParams(_audioParams || {});
  };

  _NgAudioPlayer.prototype.dispatchReadiness = function () {
    this.ready = true;
    if (undefined !== ngutils) {
      ngutils.event.dispatch(this.id, 'ready');
    }
  };

  _NgAudioPlayer.prototype.initForAsync = function (callback) {
    if (!this._wait_for_async) {
      callback();
      return true;
    }

    const $audio = $('audio', this.$element);
    const $sources = $('source', $audio);

    if (!$audio.length) {
      throw "Can't initForAsync";
    }

    if (!$sources.length) {
      const $source = $('<source/>');
      $source.attr('src', `${PHP.get('www_root')}/content/micro.mp3`);
      $source.attr('type', 'audio/mpeg');
      $audio.append($source);
      $audio[0].pause();
      $audio[0].load();
      $audio[0].currentTime = 0;
    }

    this._wait_for_async = false;

    setTimeout(callback, 150);
  };

  _NgAudioPlayer.prototype.updateParams = function (params) {
    // background color for the waves, etc, taking care not to overwrite
    // whatever's currently there, if anything
    this._options = $.extend(this._options || {}, params.options || {});

    this._author_display = getParam(
      params.player_params,
      'author_display',
      null,
      this._player_params,
    );

    this._images = getParam(this._params, 'images');

    // the global player is a condensed view of the player,
    // for example
    this._condensed = getParam(
      params.player_params,
      'condensed',
      false,
      this._player_params,
    );
  };

  _NgAudioPlayer.prototype.trackProgress = function () {
    // updates display
    this.updateProgress();

    const container = this.$container;
    const completed = this.getProgress() / this.getDuration();

    if (!this._use_progress_scrubber) {
      const pos = completed * container.width();

      container.find('span').css('left', `${pos}px`);
      container
        .find('div > div')
        .css('width', `${pos + 1 > container.width() ? pos : pos + 1}px`);
    } else {
      container.slider('value', this.getProgress());
    }
  };

  /**
   * This only currently gets called from Howler, it's whether
   * or not to set the container as a slider - e.g. a scrubber
   * to move through the track, OR use waveform images, which are
   * clickable and  put the user at the position of the track
   * they've clicked, relative to the image (e.g. if they
   * click in the middle of the waveform image, it'll put
   * playback to halfway through the track).
   */
  _NgAudioPlayer.prototype.initContainer = function () {
    const container = this.$container;
    let images = null;

    if (this._images) {
      if (this._condensed) {
        images = this._images.condensed;
      } else {
        images = this._images.listen;
      }
    }

    let was_playing = false;

    const start = (_event, _ui) => {
      was_playing = this.getPlayerObject().isPlaying();

      if (was_playing) {
        this.pause();
      }
    };

    if (!this._use_progress_scrubber) {
      // clear the container of any content it currently has
      container.empty();

      // creates two divs, one with the completed image in the background
      // and another as an overlay, which gets revealed as the time progresses
      const d = $(document.createElement('div'));
      d.css({
        position: 'absolute',
        width: '100%',
        height: `${container.height()}px`,
        overflow: 'hidden',
      });

      const bg = d.clone();

      const fg = d.clone();
      // start the overlay at 1px, so that the cursor is visible
      fg.css('width', '1px');

      // we can initialize howler without waves
      if (null !== images) {
        const i = $(
          `<img src="${images.playing.url}" width="${container.width()}" height="100%" alt="wf">`,
        );

        const i2 = $(
          `<img src="${images.playing.url}" width="${container.width()}" height="100%" alt="wf">`,
        );

        bg.append(i);
        fg.append(i2);

        fg.addClass('overlay');
      }

      // this 1px wide span displays the current position (or
      // cursor) of the track as it's playing / paused.
      const s = $(document.createElement('span'));
      s.css({
        position: 'absolute',
        width: '1px',
        height: '100%',
        left: '0',
        'background-color': this._options.cursorColor,
        top: 0,
        'z-index': '3',
      });

      //fg.append(s);
      bg.append(fg);
      container.append(bg);

      bg.slider({
        min: 0,
        max: this.getDuration(),
        step: 0.1,
        slide: (_event, ui) => {
          const w = (ui.value / this.getDuration()) * bg.width();
          fg.css('width', `${w}px`);
          this.updateProgress(ui.value);
        },
        start: start,
        stop: (_event, ui) => {
          // for some reason, even if was_playing is true,
          // mobile ignores it. No time for love.
          if (PHP.get('ismobile') || was_playing) {
            this.play(ui.value);
          } else {
            this.seek(ui.value);
          }
        },
      });
    } else {
      // turn container click events off before initializing
      // it
      const instance = container.slider('instance');

      if (instance) {
        instance.destroy();
      } else {
        container.off();
      }

      container.slider({
        orientation: 'horizontal',
        //value: volumeLevel,
        // this is critical in terms of getting the
        // fill color in the slider
        range: 'min',
        min: 0,
        max: this.getDuration(),
        step: 1,
        // as the person slides this thing, update the value
        // in the timeline, so they can see a time representation
        // of where they're dragging to
        slide: (_event, ui) => {
          if (this._current_playlist) this._current_playlist.resetStartTime();
          this.updateProgress(ui.value);
        },

        start: (_event, _ui) => {
          was_playing = this.getPlayerObject().isPlaying();

          if (was_playing) {
            this.pause();
          }
        },
        stop: (_event, ui) => {
          // for some reason, even if was_playing is true,
          // mobile ignores it. No time for love.
          if (PHP.get('ismobile') || was_playing) {
            this.play(ui.value);
          } else {
            this.seek(ui.value);
          }
        },
      });
    }
  };

  _NgAudioPlayer.prototype.initPlayer = function () {
    if (!this._current_playlist) {
      return false;
    }

    const current_item = this._current_playlist.getCurrentItem();

    if (!current_item) {
      return false;
    }

    let src = null;

    try {
      // currently only have mp3 as sources, and only one of them
      src = current_item.getSources().mp3[0].src;
    } catch (_e) {
      return false;
    }

    if (this._player_object) {
      this._player_object.unload();
    }

    let o;
    let n;
    if (false || (null === this._images && false === this._condensed)) {
      o = this.initWaveSurfer(src);
      n = 'WaveSurfer';
    } else {
      if (PHP.get('ismobile') && this._condensed) {
        o = this.initNativePlayer(src);
        n = 'NativeAudio';
      } else {
        // we can take advantage of advanced features in howler,
        // like seekable time ranges
        o = this.initHowler(src);
        n = 'Howler';
      }
    }

    this._player_object = new Player(o, n);
    this._player_object._player = this;

    $(window).on('unload', () => {
      this.saveProgress();
    });

    this.html = $(this._options.container);
  };

  _NgAudioPlayer.prototype.initNativePlayer = function (src) {
    const $element = $('audio', this.$element);

    const $source = $('<source/>');
    $source.attr('src', src);
    $source.attr('type', 'audio/mpeg');

    $element.html('');
    $element.append($source);

    const p = new _NativeAudio($element);

    this.initControls();

    p.on('end', this.onEnd);
    p.on('play', this.trackProgress.bind(this));
    p.on('load', () => {
      this.initControls();
      this.initContainer();
      this.dispatchReadiness();
    });

    /* FIXME - this isn't used?
    const step = () => {
      this.trackProgress();
      if (this.isPlaying()) {
        this.trackProgress();
        setTimeout(step, 100);
      }
    };
    */

    return p;
  };

  _NgAudioPlayer.prototype.initHowler = function (src) {
    const positions = () => {
      this.trackProgress();
    };

    this.initControls();

    // remove everything first ?
    const howler = new Howl({
      html5: true,
      src: src,
    });

    const step = () => {
      if (this.isPlaying()) {
        positions();
        window.setTimeout(step, 100);
      }
    };

    howler.on('play', () => {
      step();
    });

    howler.on('end', this.onEnd);

    howler.on('load', () => {
      this.initControls();
      this.initContainer();
      this.dispatchReadiness();
    });

    howler.on('seek', positions);
    howler.on('stop', positions);

    return howler;
  };

  /**
   * Sets up the WaveSurfer object, based on the params we've been given.
   */
  _NgAudioPlayer.prototype.initWaveSurfer = function (src) {
    const options = this._options;

    const waveSurfer = WaveSurfer.create(options);

    waveSurfer.on('finish', this.onEnd);

    // call the global initialization of controls
    waveSurfer.on('ready', () => {
      this.initControls();
      this.dispatchReadiness();
    });

    waveSurfer.on('loading', this.initPlaybackInfo.bind(this));

    if (this.$progress?.exists()) {
      let last_seconds = 0;
      let current_seconds = 0;

      // don't update constantly, only do so on change
      waveSurfer.on('audioprocess', () => {
        current_seconds = Math.round(waveSurfer.getCurrentTime());

        if (current_seconds !== last_seconds) {
          last_seconds = current_seconds;
          this.updateProgress();
        }
      });
    }

    waveSurfer.load(src);

    return waveSurfer;
  };

  _NgAudioPlayer.prototype.initialize = function (init_controls, src) {
    const v = document.createElement('audio');

    this._initialized = true;
    this.id = btoa(Math.random()).substring(0, 12);

    if (!v.canPlayType?.('audio/mpeg')?.replace(/no/, '')) {
      if (this.$loading) {
        this.$loading.remove();
      }
      this._can_play = false;

      // fixme, change this
      $('#cant-play-mp3').show();
    } else {
      this.initPlayer(src);

      if (init_controls) {
        this.initControls();
      }
    }

    return this;
  };

  /**
   * Get an instance of the player.
   */
  _NgAudioPlayer.get = (params) => {
    const player = new _NgAudioPlayer(params);

    return player.initialize();
  };

  /**
   * Get any player control id strings with a prefix.
   * returns an associative array of name => named_id,
   * with the prefix before the id.
   */
  _NgAudioPlayer.getControlIdsFromPrefix = (prefix) => {
    const names = [
      'loop',
      'next',
      'pause',
      'play',
      'previous',
      'fastForward',
      'repeat',
      'rewind',
      'shuffle',
      'soundOff',
      'soundOn',
      'stop',
      'volume',
      'volumeToggle',
    ];

    const ids = {};
    for (let i = 0, len = names.length; i < len; ++i) {
      ids[names[i]] = `#${prefix}${names[i]}`;
    }

    return ids;
  };

  _NgAudioPlayer.fromListenPage = (params, height) => {
    const _params = {
      controls: _NgAudioPlayer.getControlIdsFromPrefix('audio-listen-'),
      params: params,
      player_params: {
        container: '#waveform',
        loading: '#loading-audio',
        progress: '#audio-listen-progress',
        duration: '#audio-listen-duration',
        // don't use the slider here, clicking waveform
        // pushes progress on
        use_progress_scrubber: false,
      },

      // these are mainly for WaveSurfer
      options: {
        container: '#waveform',
        waveColor: '#fc0',
        progressColor: '#fff',
        cursorColor: '#fe2',
        height: height,
      },
    };

    const player = new _NgAudioPlayer('audio-listen-wrapper', _params);
    const playlist = new AudioPlaylist('audio-listen-wrapper');
    player.addPlaylist(playlist);
    playlist.setPlayer(player);

    const item_params = $.extend({}, params, {
      container: _params.options.container,
    });
    const item = new AudioItem(item_params);
    item.addSource(params.url, 'audio', 'mp3');

    playlist.setCurrentItem(item);
    item.setPlaylist(playlist).setPlayer(player);

    return player.initialize();
  };

  _NgAudioPlayer.getCondensed = (params) => {
    const _params = {
      controls: _NgAudioPlayer.getControlIdsFromPrefix('condensed-'),
      params: params,
      player_params: {
        condensed: true,
        container: '#condensed-progress-container',
        play: $('#condensed-play'),
        use_progress_scrubber: true,
        volume_settable: false,
      },
      options: {
        container: '#condensed-progress-container',
      },
    };

    const player = new _NgAudioPlayer('condensed', _params);
    const playlist = new AudioPlaylist('condensed');
    player.addPlaylist(playlist);

    const item = new AudioItem(params);
    item.addSource(params.url, 'audio', 'mp3');

    playlist.setCurrentItem(item);
    item.setPlaylist(playlist).setPlayer(player);

    player.initialize(true);

    // this player doesn't have volume controls,
    // so we set the volume to full (but don't store the
    // result, so whatever the user's preference was in other
    // player instances doesn't get overridden)
    player.setVolume(100, false);

    return player;
  };

  _NgAudioPlayer.global = null;

  _NgAudioPlayer.registerGlobalPlayer = (id) => {
    const _params = {
      controls: _NgAudioPlayer.getControlIdsFromPrefix('global-audio-player-'),
      player_params: {
        condensed: true,
        author_display: '#_ngHiddenAudioPlayerDetails',
        standalone: false,
      },
    };

    const player = new _NgAudioPlayer(id, _params);

    // create a global catch-all playlist
    const playlist = new AudioPlaylist('global-audio');
    player.setPlaylist(playlist);

    // register any audio playback items
    const items = $('[data-audio-playback]');

    items.each(function () {
      // skip anything already registered
      if ($(this).attr('data-registered')) {
        return this;
      }

      // use the global playlist by default
      let _playlist = playlist;

      // but check container elements to see if we should be using a specific playlist id
      const playlist_id = $(this)
        .closest('[data-audio-playlist]')
        .data('audio-playlist');
      if (playlist_id) {
        // get or create the playlist for this id
        _playlist = player.getPlaylist(playlist_id);
        if (!_playlist) {
          _playlist = new AudioPlaylist(playlist_id);
          _playlist.setPlayer(player);
        }
      }

      // set whatever playlist this is going into as the active one
      player.setPlaylist(_playlist);

      const item = new AudioItem($(this));
      player.addItem(item);

      return this;
    });

    // look for the first load more element in the page.
    const $loadMore = $("[data-playlist-func='load-more']").first();
    if ($loadMore.length) {
      // we'll use the global playlist by default
      let _playlist = playlist;

      // but check container elements to see if we should be using a specific playlist id
      const playlist_id = $loadMore
        .closest('[data-audio-playlist]')
        .data('audio-playlist');
      if (playlist_id) {
        // get the playlist for this id (if it exists)
        _playlist = player.getPlaylist(playlist_id);
      }

      // assuming we still have a playlist, attach the load more element to it
      if (_playlist) _playlist.setLoadMoreElement($loadMore);
    }

    // tell the player to use the global playlist, so any
    // new media (like in the site footer) won't get added to the wrong playlist
    player.setPlaylist(playlist);

    // load initial file
    player.initialize(true);

    // make the player statically accessible
    _NgAudioPlayer.global = player;
  };

  // make globally accessible
  NgMediaPlayer = _NgMediaPlayer;
  NgAudioPlayer = _NgAudioPlayer;
})(jQuery);
