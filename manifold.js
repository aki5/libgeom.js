(function(window){
	"use strict";

	function New() {
		return new Manifold();
	}

	function Manifold() {
		this.numEdges = 0;
		this.capEdges = 256;
		this.next = new Int32Array(this.capEdges);
		this.data = new Int32Array(this.capEdges);
		this.flag = new Uint8Array(this.capEdges);
		this.edges = new Uint16Array(this.capEdges);

		this.numVerts = 0;
		this.capVerts = 256;
		this.positions = new Float32Array(4*this.capVerts);
		this.normals = new Float32Array(3*this.capVerts);
		this.colors = new Uint8Array(4*this.capVerts);

		this.numTriangles = 0;
		this.capTriangles = 256;
		this.triangles = new Uint16Array(3*this.capTriangles);

		this.normalBuffer = null;
		this.positionBuffer = null;
		this.colorBuffer = null;

		this.triangleIndexBuffer = null;
		this.edgeIndexBuffer = null;
	}

	Manifold.prototype.growTriangles = function() {
		this.capTriangles *= 2;
		var newTriangles = new Uint16Array(3*this.capTriangles);
		newTriangles.set(this.triangles);
		this.triangles = newTriangles;
	}

	Manifold.prototype.growEdges = function() {
		this.capEdges *= 2;
		var newNext = new Int32Array(this.capEdges);
		newNext.set(this.next);
		this.next = newNext;

		var newData = new Int32Array(this.capEdges);
		newData.set(this.data);
		this.data = newData;

		var newFlag = new Uint8Array(this.capEdges);
		newFlag.set(this.flag);
		this.flag = newFlag;

		var newEdges = new Uint16Array(this.capEdges);
		newEdges.set(this.edges);
		this.edges = newEdges;
	}

	Manifold.prototype.growVerts = function() {
		this.capVerts *= 2;

		var newPositions = new Float32Array(4*this.capVerts);
		newPositions.set(this.positions);
		this.positions = newPositions;

		var newNormals = new Float32Array(3*this.capVerts);
		newNormals.set(this.normals);
		this.normals = newNormals;

		var newColors = new Float32Array(4*this.capVerts);
		newColors.set(this.colors);
		this.colors = newColors;
	}

	Manifold.prototype.Right = function(edge) { return (edge&-4) + ((edge+1)&3); }
	Manifold.prototype.Flip = function(edge) { return (edge&-4) + ((edge+2)&3); }
	Manifold.prototype.Left = function(edge) { return (edge&-4) + ((edge+3)&3); }
	Manifold.prototype.Next = function(edge) { return this.next[edge]; }
	Manifold.prototype.Data = function(edge) { return this.data[edge]; }

	/* clockwise around source vertex */
	Manifold.prototype.Prev = function(edge) {
		return this.Right(this.Next(this.Right(edge)));
	}

	/* counterclockwise around left face */
	Manifold.prototype.NextLeft = function(edge) {
		return this.Right(this.Next(this.Left(edge)));
	}

	/* clockwise around left face */
	Manifold.prototype.PrevLeft = function(edge) {
		return this.Flip(this.Next(edge));
	}

	/*  counterclockwise around right face */
	Manifold.prototype.NextRight = function(edge) {
		return this.Left(this.Next(this.Right(edge)));
	}

	/*  clockwise around right face */
	Manifold.prototype.PrevRight = function(edge) {
		return this.Next(this.Flip(edge));
	}

	/*
	 *	construction operators
	 */
	Manifold.prototype.SetVertex = function(vert, pos, normal) {
		this.positions.set(pos, 4*vert);
		this.normals.set(normal, 3*vert);
		return vert;
	}

	Manifold.prototype.Position = function(vert) {
		return this.positions.subarray(4*vert, 4*vert+4);
	}

	Manifold.prototype.Normal = function(vert) {
		return this.normals.subarray(3*vert, 3*vert+3);
	}

	Manifold.prototype.Color = function(vert) {
		return this.colors.subarray(4*vert, 4*vert+4);
	}

	Manifold.prototype.AllocVertex = function() {
		var vert = this.numVerts;
		if(vert >= this.capVerts)
			this.growVerts();
		this.numVerts = vert+1;
		return vert;
	}

	/*
	 *	In a valid quad-edge data structure, we have the option of constructing
	 *	- an edge with two separate vertices and one face, or
	 *	- an edge with two separate faces but just one vertex.
	 *
	 *	The former makes physical sense as a line segment, but it needs two
	 *	vertices.
	 */
	Manifold.prototype.SetEdge = function(edge, next, data) {
		this.next.set(next, edge);
		this.data.set(data, edge);
	}

	Manifold.prototype.AddEdge = function(srcData, dstData, faceData) {
		var edge = this.numEdges;
		if(edge+4 > this.capEdges)
			this.growEdges();
		this.SetEdge(edge, [edge, edge+3, edge+2, edge+1], [srcData, faceData, dstData, faceData]);
		this.numEdges = edge+4;
		return edge;
	}

	Manifold.prototype.Splice = function(a, b) {
		var anext = this.Next(a);
		var bnext = this.Next(b);
		var alpha = this.Right(anext);
		var beta = this.Right(bnext);
		var alphanext = this.Next(alpha);
		var betanext = this.Next(beta);

		this.next[a] = bnext;
		this.next[b] = anext;
		this.next[alpha] = betanext;
		this.next[beta] = alphanext;
	}

	Manifold.prototype.Connect = function(a, b) {
		var srcData = this.Data(this.Flip(a));
		var dstData = this.Data(b);
		var faceData = this.Data(this.Left(a));
		var edge = this.AddEdge(srcData, dstData, faceData);
		this.Splice(edge, this.NextLeft(a));
		this.Splice(this.Flip(edge), b);
		return edge;
	}

	Manifold.prototype.Disconnect = function(edge) {
		this.Splice(edge, this.Prev(edge));
		this.Splice(this.Flip(edge), this.Prev(this.Flip(edge)));
	}

	Manifold.prototype.AddFaceNormals = function(ei) {
		var normx = 0.0, normy = 0.0, normz = 0.0, normlen;
		var efirst = ei;
		var edge = efirst;
		do {
			var p0 = this.Position(this.Data(edge));
			edge = this.NextLeft(edge);
			var p1 = this.Position(this.Data(edge));
			normx += (p0[1] - p1[1]) * (p0[2] + p1[2]);
			normy += (p0[2] - p1[2]) * (p0[0] + p1[0]);
			normz += (p0[0] - p1[0]) * (p0[1] + p1[1]);
		} while(edge != efirst);

		normlen = Math.sqrt(normx*normx + normy*normy + normz*normz);
		//if(normlen < 1.0)
			console.log("newell normals: small area: " + normlen);
		normx /= normlen;
		normy /= normlen;
		normz /= normlen;

		edge = efirst;
		do {
			var normal = this.Normal(this.Data(edge));
			normal.set([normal[0]+normx, normal[1]+normy, normal[2]+normz]);
			edge = this.NextLeft(edge);
		} while(edge != efirst);
	}

	Manifold.prototype.Triangulate = function() {
		this.normals.fill(0.0, 0, 3*this.numVerts);
		this.flag.fill(0, 0, this.numEdges);
		for(var i = 0; i < this.numEdges; i += 2){
			if(this.flag[i] != 0)
				continue;
			var efirst = i;
			var edge = i;
			var normal = this.Normal(this.Data(edge));
			this.AddFaceNormals(edge);
			var count = 0;
			do {
				if(count >= 3){
					edge = this.Connect(efirst, edge);
					count = 1;
				}
				this.flag[edge] = 1;
				this.Normal(this.Data(edge)).set(normal);
				edge = this.NextLeft(edge);
				count++;
			} while(edge != efirst);

			var edge = efirst;
			count = 0;
			do {
				if(count >= 3){
					console.log("triangulate catastrophic failure!");
					break;
				}
				if(this.numTriangles+count > this.capTriangles)
					this.growTriangles();
				this.triangles.set([this.Data(edge)], 3*this.numTriangles+count);
				edge = this.NextLeft(edge);
				count++;
			} while(edge != efirst);
			if(count == 3)
				this.numTriangles++;
		}

		// normalize normals
		for(var i = 0; i < this.numVerts; i++){
			var norm = this.Normal(i);
			var normlen = Math.sqrt(norm[0]*norm[0] + norm[1]*norm[1] + norm[2]*norm[2]);
			norm[0] /= normlen;
			norm[1] /= normlen;
			norm[2] /= normlen;
		}

		// set colors to red.
		for(var i = 0; i < this.numVerts; i++){
			this.Color(i).set([42, 150, 89, 255]);
		}

		for(var i = 0; i < this.numEdges/2; i++){
			this.edges.set([this.Data(2*i)], 2*i);
			this.edges.set([this.Data(this.Flip(2*i))], 2*i+1);
		}

		console.log("Triangulate: " + this.numTriangles + " triangles");
	}

	/*
	 *	Load, Unload, Bind, BindEdges and BindVertices for webgl.
	 */
	Manifold.prototype.Load  = function(gl) {

		if(this.positionBuffer == null){
			this.positionBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, this.positions.subarray(0, 4*this.numVerts), gl.STATIC_DRAW);
			gl.bindBuffer(gl.ARRAY_BUFFER, null);
		}

		if(this.normalBuffer == null){
			this.normalBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, this.normals.subarray(0, 3*this.numVerts), gl.STATIC_DRAW);
			gl.bindBuffer(gl.ARRAY_BUFFER, null);
		}

		if(this.colorBuffer == null){
			this.colorBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
			gl.bufferData(gl.ARRAY_BUFFER, this.colors.subarray(0, 4*this.numVerts), gl.STATIC_DRAW);
			gl.bindBuffer(gl.ARRAY_BUFFER, null);
		}


		if(this.triangleIndexBuffer == null){
			this.triangleIndexBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.triangleIndexBuffer);
			gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.triangles.subarray(0, 3*this.numTriangles), gl.STATIC_DRAW);
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
		}


		if(this.edgeIndexBuffer == null){
			this.edgeIndexBuffer = gl.createBuffer();
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.edgeIndexBuffer);
			gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.edges.subarray(0, this.numEdges), gl.STATIC_DRAW);
			gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
		}
	}

	Manifold.prototype.Unload = function(gl) {
		if(this.normalBuffer != null){
			gl.deleteBuffer(this.normalBuffer);
			this.normalBuffer = null;
		}

		if(this.positionBuffer != null){
			gl.deleteBuffer(this.positionBuffer);
			this.positionBuffer = null;
		}

		if(this.colorBuffer != null){
			gl.deleteBuffer(this.colorBuffer);
			this.colorBuffer = null;
		}

		if(this.triangleIndexBuffer != null){
			gl.deleteBuffer(this.triangleIndexBuffer);
			this.triangleIndexBuffer = null;
		}

		if(this.edgeIndexBuffer != null){
			gl.deleteBuffer(this.edgeIndexBuffer);
			this.edgeIndexBuffer = null;
		}
	}

	Manifold.prototype.Bind = function(gl){
		// Set up all the vertex attributes for vertices, normals and colors
		gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
		gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 0, 0);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
		gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

		gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
		gl.vertexAttribPointer(2, 4, gl.UNSIGNED_BYTE, true, 0, 0);
	}

	Manifold.prototype.BindTriangles = function(gl){
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.triangleIndexBuffer);
	}

	Manifold.prototype.BindEdges = function(gl){
		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.edgeIndexBuffer);
	}

	window["manifold"] = { New: New, Manifold: Manifold };
})(window);
