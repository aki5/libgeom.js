(function(window){

	function New(mousex, mousey, width, height, eye, invProj, invView) {
		return new Ray(mousex, mousey, width, height, eye, invProj, invView);
	}

	function Ray(mousex, mousey, width, height, eye, invProj, invView) {
		var rayNDS = [
			(2.0 * mousex) / width - 1.0,
			1.0 - (2.0 * mousey) / height
		];
		var rayClip = [rayNDS[0], rayNDS[1], -1.0, 1.0];
		var rayEye = invProj.Transpoint4(rayClip);
		rayEye =[rayEye[0], rayEye[1], -1.0, 0.0];
		var rayDir = invView.Transpoint4(rayEye);
		rayDir = norm3(rayDir);
		this.direction = rayDir;
	}

	Ray.prototype.Direction = function() {
		return this.direction;
	}

	window["ray"] = {New: New};
})(window);
