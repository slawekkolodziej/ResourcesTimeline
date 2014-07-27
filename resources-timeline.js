/**
 * ResourcesTimeline - Presentes loading time of various page items directly 
 * on the page (https://github.com/slawekkolodziej/resourcestimeline)
 * 
 * Copyright 2014, Slawek Kolodziej
 * Released under the MIT license
 */
(function () {

    var SVGNS = 'http://www.w3.org/2000/svg';

    // Utility function for setting attributes to the element, usage:
    // attr(element, hashOfAttributes)
    // or
    // attr(link, 'href', 'http://github.com')
    function attr(el, k, v) {
        if (typeof k === 'object') {
            for (var n in k) {
                if (k.hasOwnProperty(n)) {
                    attr(el, n, k[n]);
                }
            }
            return;
        }

        el.setAttribute(k, v);
    }

    // Utility function for creating elements in the SVG namespace
    function createElement(name) {
        return document.createElementNS(SVGNS, name);
    }

    // Utility function for checking if given variable is a number
    function isNum (n) {
        return typeof n === 'number';
    }

    // Utility function for transforming URL into a short name, examples:
    // - http://github.com => github.com
    // - http://underscorejs.org/underscore.js => underscore.js
    // - https://www.google.com/images/srpr/logo11w.png => logo11w.png
    var getName = (function () {
        var a = document.createElement('a'),
            nameRe = /^\/[^\/]+$/;

        return function (url) {
            a.href = url;

            var name = a.pathname;

            if (name === '/') {
                return a.hostname;
            }

            if (nameRe.test(name)) {
                return name.slice(1);
            }

            name = name.split('/');
            return name[name.length - 1];
        };
    }());

    // Humble SVG gantt graphing library, made specially for this demo
    function SimpleGantt(parent) {
        this.container = createElement('svg');
        this.margin = [0, 0, 0, 0];
        this.markSpacing = 0;

        attr(this.container, 'xmlns', 'http://www.w3.org/2000/svg');
        this.container.setAttributeNS(SVGNS, 'xlink', 'http://www.w3.org/1999/xlink');

        parent = parent || document.body;
        parent.appendChild(this.container);
    }
    SimpleGantt.prototype = {
        padding: 0.1,

        style: {
            column: {
                fill: '#B891DB',
                rx: 8
            },

            label: {
                'dy': '0.5ex',
                'font-size': 14,
                'font-family': 'Helvetica'
            },

            markLabel: {
                'dy': '1.5ex',
                'text-anchor': 'end',
                'font-size': 12
            }
        },

        // Set SVG size (viewBox is set to the same size)
        setSize: function (x, y, w, h) {
            this.box = {
                width: w,
                height: h,
                x: x,
                y: y
            };

            attr(this.container, {
                viewBox: [x, y, w, h].join(' '),
                width: w,
                height: h
            });
        },
      
        // Set margins for the plotBox. Use this to make room 
        // for the title or domComplete/load events labels
        // 
        // Arguments follows the CSS 'margin' property:
        // top, right, bottom, left
        setMargin: function (t, r, b, l) {
            this.margin = [t, r, b, l];
        },

        // After changing margins, plotBox size should be updated
        updatePlotBox: function () {
            this.plotBox = {
                width: this.box.width - (this.margin[1] + this.margin[3]),
                height: this.box.height - (this.margin[0] + this.margin[2]),
                x: this.margin[3],
                y: this.margin[0]
            };
        },

        // Method used to update scale, it should be called when data,
        // extremes or margins changes
        updateScale: function () {
            this.updatePlotBox();

            // On the first sight it may looks kind of weird that scaleY is horizonal
            // and scaleX is vertical, but when you think about it as a data values,
            // it starts making sense
            this.scaleY = this.plotBox.width / this.extremes[1];
            this.scaleX = this.plotBox.height / this.data.length;
        },

        // Function used to set data to the graph. Data should looks like this:
        // [
        //   [[min1, max1], point],
        //   [[min2, max2], point]
        // ]
        // min & max should be numbers, point is an object,
        // where we can put detailed informations
        setData: function (data) {
            this.data = data;
            this.extremes = data.reduce(this.getExtremes);

            // Round up right extreme
            this.extremes[1] = Math.ceil(this.extremes[1] / 100) * 100;

            this.updateScale();
        },
      
        // Method used to retrieve extremes for the current data. This method
        // was made to work with Array#reduce inside setData
        getExtremes: function (a, b, n) {
            a = (n === 1) ? a[0] : a;
            
            var current = [];
            
            if (isNum(this.max)) {
                current.push(this.max);
            }

            if (isNum(this.min)) {
                current.push(this.min);
            }

            var arr = a.concat(b[0], current),
                max = Math.max.apply(null, arr),
                min = Math.min.apply(null, arr);

            return [min, max];
        },

        // Method to manually set extremes. User-defined extremes
        // has priority over extremes found in the data
        setExtremes: function (min, max) {
            if (isNum(min)) {
                this.min = min;
            }
            
            if (isNum(max)) {
                this.max = max;
            }
        },

        // Utility method creates text node used to measure text's bounding boxes
        getTextBBox: function (str) {
            if (!this._textHelper) {
                this._textHelper = createElement('text');
                this.container.appendChild(this._textHelper);
                attr(this._textHelper, {
                    opacity: 0
                });
            }

            this._textHelper.textContent = str;

            return this._textHelper.getBBox();
        },
      
        // Cleans up utility nodes
        cleanUp: function () {
            if (this._textHelper) {
                this.container.removeChild(this._textHelper);
            }
        },

        // Method handles rendering columns and data labels inside them
        render: function () {
            var group = createElement('g'),
                fragment = document.createDocumentFragment(),
                width = this.plotBox.width;
            
            attr(group, 'transform', 'translate(' + this.plotBox.x + ',' + this.plotBox.y + ')');
            
            this.data.forEach(function (point, x) {
                var duration = point[1].duration.toFixed(2) + 'ms',
                    labelX = this.scaleY * point[0][0] + 5,
                    labelY = this.scaleX * (x + 0.5),
                    label;

                fragment.appendChild(this.renderColumn(point[0], x));

                label = this.renderLabel(labelX, labelY, duration);

                if (width < labelX + this.getTextBBox(duration).width) {
                    attr(label, {
                        'text-anchor': 'end',
                        x: labelX - 10
                    });
                }

                fragment.appendChild(label);
            }, this);
            
            group.appendChild(fragment);
            this.container.appendChild(group);
        },
      
        // Method renders single column. Accepted arguments:
        // data - as defined eariler, in setData method, this is the data for a single point
        // n - index of the point
        renderColumn: function (data, n) {
            var el = createElement('g'),
                r1 = createElement('rect'),
                r2 = createElement('rect');
            
            attr(r1, this.style.column);
            attr(r1, {
                fill: '#E0CEF0',
                x: this.scaleY * data[0],
                y: this.scaleX * (n + this.padding),
                width: this.scaleY * (data[2] - data[0]),
                height: this.scaleX * (1 - 2 * this.padding)
            });

            attr(r2, this.style.column);
            attr(r2, {
                x: this.scaleY * data[1],
                y: this.scaleX * (n + this.padding),
                width: this.scaleY * (data[2] - data[1]),
                height: this.scaleX * (1 - 2 * this.padding)
            });


            el.appendChild(r1);
            el.appendChild(r2);
            
            return el;
        },

        // Method used for rendering labels on the side of the graph. Argument
        // 'labels' should be an array of strings.
        renderLabels: function (labels) {
            var group = createElement('g'),
                fragment = document.createDocumentFragment(),
                marginLeft = this.margin[3],
                marginTop = this.margin[0],
                bbox;
            
            labels.forEach(function (label, n) {
                var labelY = this.scaleX * (n + 0.5) + marginTop;
                fragment.appendChild(this.renderLabel(marginLeft, labelY, label.slice(0, 20)));
            }, this);
            
            group.appendChild(fragment);
            this.container.appendChild(group);

            // After rendering labels, measure the size of them...
            bbox = group.getBBox();
            
            // ...and update left margin, so the data won't overlap labels
            this.margin[3] = marginLeft + bbox.width + 10;
        },

        // Method used to render a single label. Arguments:
        // x, y - position of the label
        renderLabel: function (x, y, str) {
            var el = createElement('text');
            
            attr(el, {
                x: x,
                y: y
            });

            attr(el, this.style.label);

            el.textContent = str;

            return el;
        },

        // Method used to render chart header
        renderHeader: function () {
            var el = createElement('text');
            
            attr(el, {
                x: 10,
                y: 25,
                'font-size': 20,
                'font-family': 'Helvetica'
            });

            el.textContent = 'Resources loading timeline';

            this.container.appendChild(el);
        },

        // Method used to render line marks on the chart. It accepts
        // the following arguments:
        // y - data y
        // label - text for the mark label
        // color - line color
        renderMark: function (y, label, color) {
            var el = createElement('path'),
                margin = this.margin,
                xPos = margin[3] + y * this.scaleY,
                yPos = margin[0] + this.plotBox.height;
            
            attr(el, {
                d: ['M', xPos, margin[0], 'V', yPos + this.markSpacing + 15].join(' '),
                'stroke-width': 2,
                stroke: color
            });

            this.container.appendChild(el);


            var labelEl = this.renderLabel(xPos - 5, yPos + 2 + this.markSpacing, label);

            attr(labelEl, this.style.markLabel);

            this.container.appendChild(labelEl);

            this.markSpacing += 15;
        },

        // Method renders striped background
        renderStripes: function () {
            var fragment = document.createDocumentFragment(),
                width = this.box.width,
                height = this.scaleX,
                top = this.margin[0],
                len = this.data.length,
                el, i;

            for (i = 0; i < len; i += 2) {
                el = createElement('rect');

                attr(el, {
                    x: 0,
                    y: top + this.scaleX * i,
                    width: width,
                    height: height,
                    fill: '#eee'
                });

                fragment.appendChild(el);
            }

            this.container.insertBefore(fragment, this.container.firstChild);
        },
    };


    function createWrapper() {
        var wrapper = document.createElement('div');

        wrapper.style.cssText = 'position: fixed; overflow: auto; top: 0; left: 0; background: #fff; font-family: Helvetica; padding: 0.5em; z-index:9999999; border-width: 0 2px 2px 0; border-style: solid; border-color: #999; max-height: 100%;';
        
        document.body.appendChild(wrapper);

        return wrapper;
    }

    function createButtons(wrapper) {
        var btnCss = 'border: 1px solid #ddd; background: #fff; text-decoration: none; color: #000; font-size: 0.8em; vertical-align: middle; cursor: pointer; padding: 0.2em 0.5em; display: inline-block; margin: 0.1em;',
            btns = document.createElement('div'),
            save = document.createElement('a'),
            close = document.createElement('a'),
            svg = wrapper.innerHTML;
            
        btns.style.cssText = 'position: absolute; top: 0.5em; right: 0.5em;';

        // save button
        save.textContent = 'save';
        save.style.cssText = btnCss;
        save.href = 'data:image/svg+xml,' + svg;
        save.download = 'Resources loading timeline.svg';
        btns.appendChild(save);

        // close button
        close.textContent = 'close';
        close.style.cssText = btnCss;
        close.addEventListener('click', function (e) {
            wrapper.parentNode.removeChild(wrapper);
            e.preventDefault();
        });
        btns.appendChild(close);


        wrapper.appendChild(btns);
    }

    function notSupported(wrapper) {
        wrapper.innerHTML = '<span>This browser doesn\'t support Resource Timing API :(</span>';
    }

    window.__resourcesTimeline = function () {
        var perf = window.performance,
            resources = perf && perf.getEntriesByType && perf.getEntriesByType('resource'),
            wrapper = createWrapper();

        if (!resources) {
            return notSupported(wrapper);
        }

        // Calculate page load times
        var timing = perf.timing,
            domComplete = timing.domInteractive - timing.navigationStart,
            loaded = timing.loadEventStart - timing.navigationStart;


        // Transform resources into format accepted by SimpleGantt
        var data = resources.map(function (res) {
            return [[res.startTime, res.responseStart || res.startTime, res.responseEnd], res];
        });

        // Prepare names and initators arrays
        var names = data.map(function (point) {
            return getName(point[1].name);
        });

        var initiators = data.map(function (point) {
            return getName(point[1].initiatorType);
        });


        // Initialize and render the graph
        var g = new SimpleGantt(wrapper);

        g.setExtremes(0, timing.loadEventEnd - timing.navigationStart);
        g.setSize(0, 0, 800, data.length * 22 + 80);
        g.setMargin(35, 10, 50, 10);
        g.setData(data);

        g.renderHeader();
        g.renderLabels(names);
        g.renderLabels(initiators);

        g.updateScale();
        g.render();

        g.renderMark(0, 'Navigation start: 0ms', 'rgba(0,255,0,0.7)');
        g.renderMark(domComplete, 'DOM Complete: ' + domComplete + 'ms', 'rgba(0,0,255,0.7)');
        g.renderMark(loaded, 'Loaded: ' + loaded + 'ms', 'rgba(255,0,0,0.7)');

        g.renderStripes();

        g.cleanUp();

        createButtons(wrapper);
    };
}());