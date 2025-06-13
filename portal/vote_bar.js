VoteBar = function (you_voted_text) {
	var that = this, $ = jQuery, form;

	var afterVote = function(json, status, xhr) {
		if (status === 0) {
		} else {
			var
				//score_delta = document.createElement('span'),
				//score = $('#item_score'),
				voted_sentence = PHP.get('you_voted_text').replace('%s', json.vote)
			;

			// tell them their vote
			form.down('h3').addClass('voted').html(voted_sentence);

			if (typeof json.rendered_text !== undefined) {
				$('#aftervote').down().html(json.rendered_text);
			}
			//

			// show response
			$('#aftervote').appear();
		}
	};

	var voteError = function (response, status, xhr) {
		$('#votebar').enable();
	};

	this.vote = function (e) {

		var target = $(e.target);
		if (target.is('LABEL')) {
			if (!PHP.get('user_logged_in', false)) {
				// pop the login form into place if they're not currently a member
				PassportHandler.open().reposition($(document).scrollTop());
				return false;
			}

			/* make sure the radio input has been checked,
			 * as this happens automatically only  _after_ the "click" event is fired */
			$('#' + e.target.htmlFor).prop('checked', true);

			form = target.up('form');
			var
				form_data = form.serializeArray(),
				url = form.attr('action')
			;

			form.disable();

			// post vote
			$.ajax.startWaiting(form, $.ajax({
				type: 'post',
				url: url,
				data: form_data,
				success: afterVote,
				error: voteError
			}));
		}

		target = null; // avoid IE memory leak
	};

	/**
	 * Use this to test the display of a vote, without actually casting
	 * one, in your markup.
	 */
	this.testVote = function(score) {
		score = typeof score === typeof undefined ? 5 : score;

		form = $('#votebar');

		// simulate click
		var tv = form.find('li.v' + score).find('input[type="radio"]:not(:hidden)');
		tv.prop('checked', true);

		form.disable();

		var fake_json = {
			vote: score
		};

		afterVote(fake_json, 1, null);

	};

	this.init = function () {
		$('#votebar ul').click(this.vote); // delegate voting to the containing list element
		$('#votebar').enable(); // fix bug with firefox where form element "disabled" attribute is remembered on page load
	};

	this.lock = function() {
		$('#votebar').disable();
	};
};

