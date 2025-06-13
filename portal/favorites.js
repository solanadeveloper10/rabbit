var NgFavorites = (function() {
	var $ = jQuery, in_progress = false, current_form = null;

	var resetDefaults = function() {
		in_progress = false;
		current_form = null;
	};

	var handleResponse = function(response) {
		if (response) {
			if ($.isString(response)) {
				current_form.replaceWith($(response));
			} else if (response.url) {
				// we may have left them a message telling them
				// what they've just done
				if (response.success) {
					alert(response.success);
				}

				// get out of here early
				window.location.href = response.url;
			}
		}

	};

	var afterWards = function(response) {

		if (null !== current_form) {
			form_id = current_form.attr('id');

			// incrementCount comes only after we've dealt with the response
			handleResponse(response);

			// increment the fan count by 1
			incrementCount(form_id);

		}

		resetDefaults();
	};

	// may want to come back to this, to replace high figures with approximates
	var incrementCount = function(id) {
		var count_element = $('#count_' + id);

		if (count_element.exists()) {
			// this stuff is currently in a span
			if (count_element.children().size()) {
				count_element = count_element.children(count_element.children().size() - 1);
			}

			count_element.html(FormatNumber(parseInt(count_element.html().replace(/[^0-9]+/g, ''), 10) + 1) + ' Fans');
		}
	};

	var submitForm = function(e) {

		e.stopImmediatePropagation();

		if (in_progress) {
			alert('Sorry, another form is currently being saved.');
			return false;
		}

		current_form = $(e.target);
		in_progress = true;

		current_form.ajaxSubmit(afterWards, { error: resetDefaults });

		return false;
	};

	return {
		addListener: function(form_id_or_form) {
			var form;

			if ($.isString(form_id_or_form)) {
				if (form_id_or_form.indexOf('#') !== 0) {
					form_id_or_form = '#' + form_id_or_form;
				}

				form = $(form_id_or_form);
			} else if (form_id_or_form.is('form')) {
				form = form_id_or_form;
			} else {
				throw "Don't know how to add this.";
			}

			form.bind('submit', submitForm);
		}
	}

})();

