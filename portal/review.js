/*globals PortalReviewSubmit: true, PortalReview: true, NgFormValidator: false */
PortalReviewSubmit = function () {
	var
		$ = jQuery,
		form = $('#review_form'),
		validations = { require: [
			[ 'review_stars', 'Choose a star rating for this submission.' ],
			[ 'review_body', 'You must write a review!' ]
		] }
	;

	form.off();

	if (form.find('#review_agreed').length) {
		validations.require.push([ 'review_agreed', 'You must agree to the terms and conditions' ]);
	}

	var validator = new NgFormValidator(form, validations);

	// design gets passed as a hidden element in the form here
	this.init = function () {
		$('#review_form_show').off();

		$('#review_form_show').click(function(e) {
			var self = $(this);

			if (self.text() == 'Cancel Review') {
				self.text('Write a Review');
			} else {
				self.text('Cancel Review');
			}

			form.toggle();

			return false;
		});

		var reenable = function() {
			form.enableSubmit();
		};

		form.submit(function (e) {
			if (validator.validate()) {
				form.ajaxSubmit(function (text) {
					$('#portal_reviews_container').replaceWith($('#portal_reviews_container', text));
					form.toggle();
					$('#review_form_show').hide();
				}, {XD:true});
				return false;
			} else {
				alert(validator.getErrorMessages().join("\n"));
			}

			e.preventDefault();
		});
	};

};

PortalReview = (function ($) {
	var instance, container;

	var portal_review = function() {
		var initialized = false,
		design = null,

		voteOnReview = function (e) {
			var label = $(e.target);
			if (label.is('label')) {
				var
					radio = $('#' + e.target.htmlFor),
					form_class_names = {y: 'yes', n: 'no', x: 'x'},
					form = label.up('form')
				;

				if (!radio.prop('disabled')) {
					radio.prop('checked', true);

					form.ajaxSubmit(function (response) {
						form.disable().down('span').html(response.message);
					}, {XD: true});

					return false;
				}
			}
		},

		showResponseForm = function () {
			var self = $(this);

			// hash of the link is equal to the ID of the form
			$(this.href.substr(this.href.indexOf('#'))).toggle();

			if (-1 === self.html().indexOf('Cancel')) {
				self.data('original text', self.html());
				self.html('Cancel');
			} else {
				self.html(self.data('original text'));
			}

			return false;
		},

		submitResponse = function (e) {
			var $this = $(this);

			$this.ajaxSubmit(function (response) {
				var
					resp = $(response),
					authresponse = resp.find('div.authresponse'),
					modlinks = resp.find('div.modlinks');
				$this.enable().hide();

				var review_div = $this.prev('div');
				review_div.down('div.authresponse').remove();
				review_div.down('div.modlinks')
					.before(authresponse)
					.replaceWith(modlinks);
			}, { dataType: 'html', XD: true });

			return false;
		},

		changePage = function () {
			var data = {};
			if (design) {
				data.___ng_design = design;
			}

			if (this.href) {

				$.get(this.href, data, function(response) {
					$('#portal_reviews').replaceWith(response);
					//$('#portal_reviews').scrollTo();
				});

				return false;
			}
		},

		listenOnReviews = function () {
			container.off();
			
			// updated for jquery 3
			container
				.on('click', 'form.helpful', voteOnReview)
				.on('click', 'a.respond_to_review', showResponseForm)
				.on('click', 'div.pagenav a', changePage)
				.on('submit', 'form[id^="review-response"]', submitResponse)
			;
		};

		this.init = function (using_redesign) {
			// only initialize once
			if (!initialized) {
				design = typeof using_redesign !== typeof undef ? using_redesign : false;
				listenOnReviews();
				initialized = true;
			} else {
				alert("Initialized already.");
			}
		};
	};

	return {
		_: function (reviews_container, reset) {
			instance = new portal_review();
			container = reviews_container || $('#portal_reviews');

			return instance;
		}
	};
})(jQuery);
if (typeof(ngutils) !== typeof(undefined)) ngutils.event.dispatch('reviewjs-ready');