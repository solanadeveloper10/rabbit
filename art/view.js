var ArtView;

(function($) {
	ArtView = function () {
		// FIXME: break this up into objects and methods
		this.init = function () {
			//if ($('#votebar')) {
			//	(new VoteBar()).init();
			//}

			/* Delete */
			$('#delete_item_form').submit(function () {
				return confirm('Are you sure you want to DELETE this item?');
			});

			var
				report_form = '#report_form',
				show_report_form = '#show_report_form'
			;

			$(show_report_form).click(function (e) {
				$(report_form).toggle();
				e.preventDefault();
			});

			$('#show_moderate_form').click(function (e) {
				$('#moderate_info').toggle();
				e.preventDefault();
			});
		};

	};

	ArtView.listenDimLights = function () {
		$large_view = $('#art-large-view');
		$large_view.remove();
		
		var blackout = new ngutils.blackout();

		$('#portal_item_view').click(function() {
			blackout.show($large_view.html());
			return false;
		});
	};

	ArtView.listenFrontPage = function () {
		$('#frontpage_art').submit(function () {
			return confirm('Are you sure you want to put this art on the front page?');
		});
	};

})(jQuery);

