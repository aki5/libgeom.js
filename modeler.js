(function(window){
	"use strict";

	function New() {
		return new Modeler();
	}

	function Modeler() {
 		manifold.Manifold.call(this);
		this.numDivs = 16;
		this.stack = { matrix: mat4.New().Id(), next: null };
		console.log(this);
	}

	Modeler.prototype = Object.create(manifold.Manifold.prototype);

	Modeler.prototype.DumpEdges = function() {
		for(var i = 0; i < this.numEdges; i+=4){
			console.log(
				"" + i + ":" + this.Next(i) + " " +
				"" + (i+1) + ":" + this.Next(i+1) + " "+
				"" + (i+2) + ":" + this.Next(i+2) + " "+
				"" + (i+3) + ":" + this.Next(i+3)
			);
		}
	}

	Modeler.prototype.DumpVerts = function() {
		for(var i = 0; i < 4*this.numVerts; i+=4){
			console.log("" + i + ": " + this.positions[i].toFixed(5) + ", " + this.positions[i+1].toFixed(5) + ", " + this.positions[i+2].toFixed(5) + ", " + this.positions[i+3].toFixed(5));
		}
	}

	Modeler.prototype.Push = function() {
		var newMatrix = this.Matrix().Copy();
		this.stack = { matrix: newMatrix, next: this.stack };
		return newMatrix;
	}

	Modeler.prototype.Pop = function() {
		if(this.stack.next != null)
			this.stack = this.stack.next;
		return this;
	}

	Modeler.prototype.Matrix = function() {
		return this.stack.matrix;
	}

	Modeler.prototype.AddVertex = function(pos) {
		var vert = this.AllocVertex();
		var position = this.Position(vert);
		position.set(pos);
		this.Matrix().TransInPlace(position);
		return vert;
	}

	Modeler.prototype.Circle = function(face) {
		var vprev = this.AddVertex([1.0, 0.0, 0.0, 1.0]);
		var vfirst = vprev;
		var efirst = -1, eprev = -1;
		for (var i = 1; i < this.numDivs; i++) {
			var angle = 2.0*Math.PI*i / this.numDivs;
			this.Push().RotZ(angle);
			var vnew = this.AddVertex([1.0, 0.0, 0.0, 1.0]);
			this.Pop();
			var enew = this.AddEdge(vprev, vnew, face);
			if(eprev != -1){
				this.Splice(enew, this.Prev(this.Flip(eprev)));
			} else {
				efirst = enew;
			}
			eprev = enew;
			vprev = vnew;
		}
		var elast = this.AddEdge(vprev, vfirst, face);
		this.Splice(elast, this.Prev(this.Flip(eprev)));
		this.Splice(efirst, this.Prev(this.Flip(elast)));

		var edge = efirst;
		do {
			var nextEdge = this.NextLeft(edge);
			edge = nextEdge;
		} while(edge != efirst);

		return efirst;
	}

	Modeler.prototype.ConeTo = function(loopEdge, face) {
		var vtip = this.AddVertex([0.0, 0.0, 0.0, 1.0]);
		var etip = this.Flip(this.AddEdge(vtip, this.Data(this.Flip(loopEdge)), face));
		var edge = loopEdge;
		do {
			var nextEdge = this.PrevRight(edge);
			etip = this.Connect(etip, this.Flip(edge));
			etip = this.Flip(etip);
			edge = nextEdge;
		} while(edge != loopEdge);
		return etip;
	}

	Modeler.prototype.CylinderTo = function(loop0Edge, loop1Edge, face) {
		var edge0 = loop0Edge;
		var edge1 = loop1Edge;
		do {
			var nextEdge0 = this.PrevRight(edge0);
			var nextEdge1 = this.NextLeft(edge1);
			this.Connect(edge1, this.Flip(edge0));
			edge0 = nextEdge0;
			edge1 = nextEdge1;
		} while(edge0 != loop0Edge);
		return loop1Edge;
	}

	window["modeler"] = { New: New };
})(window);
