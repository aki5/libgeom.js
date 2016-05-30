function normal3(vert1, vert2, vert3) {
	var v21 = sub3(vert1, vert2);
	var v23 = sub3(vert3, vert2);
	var cross = cross3(v23, v21);
	return norm3(cross);
}

function add3(a, b) {
	return [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
}

function sub3(a, b) {
	return [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
}

function scale3(a, s) {
	return [a[0]*s, a[1]*s, a[2]*s];
}

function lerp3(a, b, t){
	return add3(a, scale3(sub3(b, a), t));
}

function cross3(a, b) {
	return [
		a[1]*b[2] - a[2]*b[1], // x = yzzy
		a[2]*b[0] - a[0]*b[2],
		a[0]*b[1] - a[1]*b[0]
	];
}

function dot3(a, b) {
	return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
}

function len3(a) {
	return Math.sqrt(dot3(a, a));
}

function norm3(a) {
	var t = len3(a);
	return [a[0]/t, a[1]/t, a[2]/t];
}

function theta3(a, b) {
	var cosTheta = dot3(a, b) / (len3(a)*len3(b));
	return Math.acos(cosTheta);
}


function scale4(a, s) {
	return [a[0]*s, a[1]*s, a[2]*s, a[3]*s];
}

function blend4(a, b) {
	var alpha = a[3];
	var afact = alpha;
	var bfact = 1.0-alpha;
	return [
		a[0]*afact + b[0]*bfact,
		a[1]*afact + b[1]*bfact,
		a[2]*afact + b[2]*bfact,
		a[3]*afact + b[3]*bfact,
	];
}

