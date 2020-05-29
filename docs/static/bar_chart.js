class BarChart {
    constructor(container_id) {

        this.container_id = container_id;
        this.container = d3.select(container_id);
        this.url = this.container.attr("_viz_source");
        this.chart_uid = container_id + "-" + this.url;
        this.units = UNITS.filter(d => d == this.container.attr('_viz_units'));
        this.unitFormatter = getAxisFormatter(this.units);
        this.labelFormatter = getLabelFormatter(this.units)

        let margin = { top: 20, right: 20, bottom: 20, left: 20 };
        let width = this.container_width - margin.left - margin.right;
        let height = this.container_height - margin.top - margin.bottom;

        this.svg = this.container.append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform",
                "translate(" + margin.left + "," + margin.top + ")");
    }

    get container_width() {
        return parseInt(d3.select(this.container_id).node().clientWidth);
    }

    get container_height() {
        return parseInt(d3.select(this.container_id).node().clientHeight);
    }

    log(message) {
        if (DEBUG || false) {
            console.log(message + ": " + this.chart_uid)
        }
    }

    init() {
        this.log('initializing')
        this.loadData();
    }

    update() {
        this.log('updating bar chart')
    }

    resize() {
        this.log('resizing bar chart')
    }

    loadData() {
        this.log('loading data')
    }

    rescale(ax, data) {
        // make this static?
        this.log('rescaling data')

        if (this.units == "percent") {
            ax.domain([0, 1]);
        } else {
            ax.domain([0, d3.max(data, d => d.value)]).nice()
        }
    }
}

class RegionBarChart extends BarChart {
    constructor(container_id) {
        super(container_id);

        this.selected_bar = null;
        this.breakdown_data = null;
    }

    loadData() {
        this.log('loading data')
        let that = this

        d3.csv(this.url, function(error, data) {
            if (error) throw error;

            that.raw_data = data;

            that.labels = Object.keys(data[0]).slice(3); // keys after region, group, and subgroup are values 
            that.label_map = {};
            for (let label of that.labels) {
                let obj = {};
                obj.label_list = label.split(";");
                obj.label_short = obj.label_list[0];
                obj.label_long = obj.label_list.slice(1).join('');
                that.label_map[label] = obj;
            }

            data.forEach(function(d) {
                for (let label of that.labels) {
                    d[label] = +d[label];
                }

                d['concat_label'] = d.group + "-" + d.subgroup;
                if (!d.subgroup) {
                    d['width'] = 1.5; // x times normal
                    d['label'] = d.group;
                } else {
                    d['width'] = 1; // x times normal
                    d['label'] = d.subgroup;
                }
            });

            var dataAllLong = [];
            data //.filter(d => d.group == "All")
                .forEach(function(d) {
                    for (let label of that.labels) {
                        var obj = {};
                        obj['region'] = d['region'];
                        obj['label'] = label;
                        obj['value'] = d[label];
                        d['concat_label'] = d.group + "-" + d.subgroup;
                        if (!d.subgroup) {
                            obj['width'] = 1.5; // x times normal
                            obj['demographic'] = d.group;
                        } else {
                            obj['width'] = 1; // x times normal
                            obj['demographic'] = d.subgroup;
                        }
                        dataAllLong.push(obj)
                    }
                })

            // that.dataset = data.filter(d => d.group != "All");
            // that.dataAllLong = dataAllLong;
            that.data_tidy = dataAllLong;
            that.resize();
            that.update();

        });
    }

    update() {
        this.log('updating bar chart')
        this.overview();
    }

    overview() {
        let data = this.data_tidy.filter(d => (d.region == REGION) && (d.demographic == 'All'));
        let that = this;

        let margin = { top: 20, right: 20, bottom: 20, left: 200 };
        let width = this.container_width - margin.left - margin.right;
        let height = this.container_height - margin.top - margin.bottom;

        this.svg = this.container.select("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .select("g")
            .attr("transform",
                "translate(" + margin.left + "," + margin.top + ")");

        // set the y range
        this.y = d3.scaleBand()
            .range([0, height])
            .padding(0.6);
        this.y.domain(data.map(function(d) { return d.label; }));

        // set the x range
        this.x = d3.scaleLinear()
            .range([0, width]);

        this.rescale(this.x, this.dataAllLong);

        // layout the chart
        // let width = this.width
        // let height = this.height
        let x = this.x
        let y = this.y

        const t = d3.transition().duration(500);
        const delay = function(d, i) {
            return i * 10;
        };

        this.svg.selectAll(".breakdown").remove();
        let bars = this.svg.selectAll(".bar-g")

        if (bars.empty()) {
            bars = this.svg.append('g')
                .classed('bar-g', true)
                .classed('overview', true);
        }

        let bar = bars.selectAll('.bar')
            .data(data)

        bar.exit().remove();

        var goto = this.breakdown.bind(this)

        bar.enter().append("rect")
            .on("click", function(d) {
                that.selected_bar = d3.select(this).attr('data_label');
                return goto();
            })
            .classed('overview', true)
            .classed('bar', true)
            .attr("x", function(d) { return 0; })
            .attr("y", function(d) { return y(d.label); })
            .attr("data_label", d => d.label)
            .attr("height", y.bandwidth())
            .merge(bar)
            .transition(t)
            .ease(d3.easeExp)
            .attr("width", function(d) { return x(d.value); })
            .delay(delay);

        let value_labels = bars.selectAll(".value")
            .data(data);

        value_labels.exit().remove();

        value_labels.enter().append("text")
            .attr("class", "value")
            .classed('overview', true)
            .attr("fill", "white")
            .attr("opacity", 0)
            .attr("y", function(d) { return y(d.label) + y.bandwidth() / 2; })
            .attr("dy", "0.35em") //vertical align middle
            .attr("text-anchor", "end")
            .attr("font-size", Math.min(18, y.bandwidth() * 0.95))
            .merge(value_labels)
            .transition(t)
            .attr("opacity", 1)
            .text(d => this.labelFormatter(d.value))
            .attr("x", d => x(d.value) - 7)
            .delay(delay);

        // this.svg.selectAll(".x--axis").remove()
        // add the x Axis
        // this.svg.append("g")
        //     .attr("transform", "translate(0," + this.height + ")")
        //     .classed('axis', true)
        //     .classed('x--axis', true)
        //     .classed('overview', true)
        //     .call(d3.axisBottom(this.x).tickFormat(this.unitFormatter));


        // this.svg.selectAll(".y--axis").remove()
        // // add the y Axis
        // this.svg.append("g")
        //     .classed('axis', true)
        //     .classed('y--axis', true)
        //     .classed('overview', true)
        //     .call(d3.axisLeft(this.y));

        let titles = bars.selectAll(".title")
            .data(data);

        titles.exit().remove();

        titles.enter().append("text")
            .classed("title", true)
            .classed('overview', true)
            .attr("fill", "rgb(51, 51, 51)")
            .attr("y", function(d) { return y(d.label) + y.bandwidth() / 2; })
            .attr("dy", "0.35em") //vertical align middle
            .attr("text-anchor", "end")
            .merge(titles)
            .attr("opacity", 1)
            .text(d => that.label_map[d.label].label_short)
            .attr("x", d => -15)

    }

    breakdown() {
        let new_container_height = 1900;
        d3.select(this.container_id).style('height', new_container_height)

        let selected_bar = this.selected_bar,
            data = this.data_tidy
            .filter(d => d.region == REGION && d.label == selected_bar && d.demographic != 'All'),
            margin = { top: 20, right: 20, bottom: 20, left: parseInt(this.container_width / 2) },
            width = this.container_width - margin.left - margin.right,
            height = this.container_height - margin.top - margin.bottom;

        this.svg = this.container.select("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .select("g")
            .attr("transform",
                "translate(" + margin.left + "," + margin.top + ")");

        // set the ranges
        this.y = d3.scaleBand()
            .range([10, height])
            .padding(0.2);
        this.y.domain(data.map(function(d) { return d.demographic; }));

        this.x = d3.scaleLinear()
            .range([0, width]);

        this.rescale(this.x, data)

        // let width = this.width
        // let height = this.height
        let x = this.x
        let y = this.y

        const t = d3.transition().duration(500);

        const delay = function(d, i) {
            return i * 10;
        };

        this.svg.selectAll(".overview").remove();
        this.svg.selectAll(".bar-g").remove()
        let bars = this.svg.append('g')
            .classed('bar-g', true)
            .classed('breakdown', true);


        let bar = bars.selectAll('.bar')
            .data(data)

        bar.exit().remove();

        bar.enter().append("rect")
            .classed('bar', true)
            .classed('breakdown', true)
            .attr("x", function(d) { return 0; })
            .attr("y", function(d) { return y(d.demographic); })
            .attr("height", y.bandwidth())
            .merge(bar)
            .transition(t)
            .ease(d3.easeExp)
            .attr("width", function(d) { return x(d.value); })
            .delay(delay);

        let value_labels = bars.selectAll(".value")
            .data(data);

        value_labels.exit().remove();


        value_labels.enter().append("text")
            .classed('value', true)
            .classed('breakdown', true)
            .attr("fill", "white")
            .attr("opacity", 0)
            .attr("y", function(d) { return y(d.demographic) + y.bandwidth() / 2; })
            .attr("dy", "0.35em") //vertical align middle
            .attr("text-anchor", "end")
            .attr("font-size", Math.min(18, y.bandwidth() * 0.95))
            .merge(value_labels)
            .transition(t)
            .attr("opacity", 1)
            .text(d => this.labelFormatter(d.value))
            .attr("x", d => x(d.value) - 7)
            .delay(delay);


        // this.svg.selectAll(".x--axis").remove()
        // // add the x Axis
        // this.svg.append("g")
        //     .attr("transform", "translate(0," + height + ")")
        //     .classed('axis', true)
        //     .classed('x--axis', true)
        //     .classed('breakdown', true)
        //     .call(d3.axisBottom(this.x).tickFormat(this.unitFormatter));


        this.svg.selectAll(".y--axis").remove()
        // add the y Axis
        this.svg.append("g")
            .classed('axis', true)
            .classed('y--axis', true)
            .classed('breakdown', true)
            .call(d3.axisLeft(this.y));


        let goto = this.overview.bind(this)
        let backbutton = this.svg.selectAll('.backbutton');
        if (backbutton.empty()) {
            backbutton = this.svg.append('g');
        }
        backbutton.exit().remove();
        backbutton.append('text')
            .classed('backbutton', true)
            .classed('breakdown', true)
            .attr('fill', "rgb(51, 51, 51)")
            .text("\u276E back")
            .attr("x", 0)
            .attr("y", 0)
            .on("click", goto)


        this.svg.selectAll('.demoTitle').remove();
        let title = this.svg.append('g')
        let title_text = this.label_map[selected_bar].label_long || this.label_map[selected_bar].label_short;
        title.exit().remove();
        title.append('text')
            .classed('breakdown', true)
            .classed('.demoTitle', true)
            .attr('fill', "rgb(51, 51, 51)")
            .attr("text-anchor", "end")
            .text(title_text)
            .attr("x", width)
            .attr("y", 0);
    }
}

class StackedBarChart extends RegionBarChart {
    constructor(container_id) {
        super(container_id);

        this.selected_bar = null;
    }

    loadData() {
        this.log('loading data')
        let that = this

        d3.csv(this.url, function(error, data) {
            if (error) throw error;
            that.labels = Object.keys(data[0]).slice(3); // keys after region, group, and subgroup are values 
            that.columns = [];
            that.label_map = {};

            for (let label of that.labels) {
                let obj = {}

                obj.label_list = label.split(";");
                obj.label_short = obj.label_list[0];
                obj.label_long = obj.label_list[1];
                obj.group = obj.label_list.slice(2).join('').trim();

                that.label_map[label] = obj;

                if (!that.columns.includes(obj.group)) {
                    that.columns.push(obj.group);
                }
            }

            data.forEach(function(d) {
                for (let label of that.labels) {
                    d[label] = +d[label];
                }

                d['concat_label'] = d.group + "-" + d.subgroup;
                if (!d.subgroup) {
                    d['width'] = "large";
                    d['label'] = d.group;
                } else {
                    d['width'] = "normal";
                    d['label'] = d.subgroup;
                }
            });


            var data_tidy = [];
            data //.filter(d => d.group == "All")
                .forEach(function(d) {
                    for (let label of that.labels) {
                        var obj = {};
                        obj['region'] = d['region'];
                        obj['label'] = label;
                        obj['value'] = d[label];
                        obj['concat_label'] = d.group + "-" + d.subgroup;
                        obj['column'] = that.label_map[label].group;
                        if (!d.subgroup) {
                            obj['width'] = 1.5; // x times normal
                            obj['demographic'] = d.group;
                        } else {
                            obj['width'] = 1; // x times normal
                            obj['demographic'] = d.subgroup;
                        }
                        data_tidy.push(obj)
                    }
                })

            let dataGrouped = [];
            let data_tidy_slice = data_tidy.filter(d => (d.demographic == 'All'))
            let regions = d3.map(data_tidy, d => d.region).keys()
            let columns = d3.map(data_tidy, d => d.column).keys()
            let maxGroupedValue = -1;
            for (let region of regions) {
                for (let column of columns) {
                    let _gdata = data_tidy_slice.filter(d => d.region == region && d.column == column)
                    let obj = {}
                    obj['region'] = region;
                    obj['column'] = column;
                    obj['total'] = 0;
                    for (let label of that.labels) {
                        obj[label] = 0;

                        for (let _data of _gdata) {
                            if (_data.label == label) {
                                obj[_data.label] = _data.value;
                                obj['total'] += _data.value;
                            }
                        }
                    }
                    maxGroupedValue = obj['total'] > maxGroupedValue ? obj['total'] : maxGroupedValue;
                    dataGrouped.push(obj)
                }
            }

            that.data_tidy = data_tidy;
            that.dataGrouped = dataGrouped;
            that.maxGroupedValue = maxGroupedValue;
            that.resize()
            that.update()

        });
    }

    update() {
        this.overview()

    }

    overview() {
        let that = this;
        this.data = this.dataGrouped.filter(d => d.region == REGION);


        this.margin = { top: 20, right: 70, bottom: 60, left: 20 };
        this.width = this.container_width - this.margin.left - this.margin.right;
        this.height = this.container_height - this.margin.top - this.margin.bottom;
        this.layers = d3.stack()
            .keys(that.labels)
            (that.data)

        this.t = d3.transition().duration(500);

        this.delay = function(d, i) {
            return i * 10;
        };


        this.svg.selectAll(".breakdown").remove();

        this.svg = this.container.select("svg")
            .attr("width", that.width + that.margin.left + that.margin.right)
            .attr("height", that.height + that.margin.top + that.margin.bottom)
            .select("g")
            .attr("transform",
                "translate(" + that.margin.left + "," + that.margin.top + ")");


        let z = d3.scaleOrdinal(d3.schemeCategory10);
        let n = Math.ceil(this.labels.length / 2)
        let size = 11;
        let padding = 6;
        let text_width = this.width / n;
        let itemWidth = size + padding + text_width + 5;
        let itemHeight = size + padding;

        this.legend = this.svg.selectAll('.legend');

        if (this.legend.empty()) {
            this.legend = this.svg
                .append("g")
                .classed('legend', 'true')
                .classed('overview', 'true')

            var legend_items = this.legend.selectAll('g')
                .data(that.labels)
                .enter()
                .append("g")
                .attr("transform", function(d, i) {
                    let xoff = i % n * itemWidth;
                    let yoff = ((Math.floor(i / n) * itemHeight) + that.height + 20);
                    return "translate(" + xoff + "," + yoff + ")";
                })

            var rects = legend_items.append('rect')
                .classed('legend-patch', true)
                .attr("width", size)
                .attr("height", size)

                .attr("fill", function(d, i) { return z(i); });

            var text = legend_items.append('text')
                .classed('legend-text', true)
                .attr("x", size + padding)
                .attr("y", size / 2)
                .attr('dy', '0.35em')
                .text(d => that.label_map[d].label_short);


            // legend = this.svg
            //     .append('g')
            //     .classed('legend', 'true')
            //     .classed('overview', 'true')



            // legend
            //     .append('g')
            //     .classed('legend-boxes', true)
            //     .selectAll('rect')
            //     .data(that.labels)
            //     .enter()
            //     .append("rect")
            //     .attr("x", function(d, i) { return i * (size + padding + text_width) })
            //     .attr("y", height + 20) // 100 is where the first dot appears. 25 is the distance between dots
            //     .attr("width", size)
            //     .attr("height", size)
            //     .style("fill", function(d, i) { return z(i) })

            // // Add one dot in the legend for each name.
            // legend
            //     .append('g')
            //     .classed('legend-text', true)
            //     .selectAll('text')
            //     .data(that.labels)
            //     .enter()
            //     .append("text")
            //     // .style("alignment-baseline", "middle")
            //     .attr("text-anchor", "start")
            //     .attr("font-size", "12pt")
            //     .attr("x", function(d, i) { return (size + padding) + i * (size + padding + text_width) })
            //     .attr("y", height + 20 + size / 2) // 100 is where the first dot appears. 25 is the distance between dots
            //     .attr("dy",  "0.35em" )
            //     .style("fill", function(d, i) { return z(i) })
            //     .text(function(d) { return that.label_map[d].label_short })


            // // vertical legend orientation
            // legend
            //     .append('g')
            //     .classed('legend-boxes', true)
            //     .selectAll('rect')
            //     .data(that.labels)
            //     .enter()
            //     .append("rect")
            //     .attr("x", (width) - 5)
            //     .attr("y", function(d, i) { return 0 + i * (size + padding) }) // 100 is where the first dot appears. 25 is the distance between dots
            //     .attr("width", size)
            //     .attr("height", size)
            //     .style("fill", function(d, i) { return z(i) })

            // // Add one dot in the legend for each name.
            // legend
            //     .append('g')
            //     .classed('legend-text', true)
            //     .selectAll('text')
            //     .data(that.labels)
            //     .enter()
            //     .append("text")
            //     .attr("x", width - 5 - padding)
            //     .attr("y", function(d, i) { return 0 + i * (size + padding) }) // 100 is where the first dot appears. 25 is the distance between dots
            //     .attr("dy", function(d, i) { return 0 + ((size + padding) / 2) })
            //     .style("fill", function(d, i) { return z(i) })
            //     .text(function(d) { return that.label_map[d].label_short })
            //     .attr("text-anchor", "end")
            //     .style("alignment-baseline", "middle")
        }

        let legend_width = -1
        d3.selectAll('.legend-text text').nodes().forEach(
            function(d) {
                let bbox = d.getBBox()
                legend_width = legend_width < bbox.width ? bbox.width : legend_width;

            }
        )
        legend_width += (size + padding + 5)

        // set the y range
        let y = d3.scaleLinear().range([that.height, 0])
        // this.y.domain([0, d3.max(data, d => d3.sum(that.labels, k => +d[k]))]).nice();
        y.domain([0, d3.max(that.data, d => d.total)])

        // set the x range
        let x = d3.scaleBand()
            .range([0, that.width])
            .padding(0.6);

        x.domain(that.layers[0].map(d => d.data.column))

        // let x = this.x;
        // let y = this.y;
        // let z = this.z;

        this.bars = this.svg.selectAll(".bar-g")

        if (this.bars.empty()) {
            this.bars = this.svg.selectAll(".bar-g")
                .data(that.layers)
                .enter()
                .append('g')
                .classed('bar-g', true)
                .classed('overview', true)
                .style('fill', (d, i) => (z(i)))
                .attr("data_label", (d, i) => d.key)
                .on("click", function(d, i) {
                    that.selected_bar = d3.select(this).attr('data_label');
                    return goto();
                })

        } else {
            this.bars = this.svg.selectAll(".bar-g")
                .data(that.layers);
        }

        let goto = this.breakdown.bind(this);

        this.bar = this.bars.selectAll('rect')

        this.bar.exit().remove();

        this.bar.data((d, i) => that.layers[i].filter(d => (d[1] - d[0] > 0)))
            .enter()
            .append('rect')
            .classed('stacked-bars', true)
            .classed('overview', true)
            .attr('data-xloc-left', d => x(d.data.column))
            .attr('data-xloc-right', d => x(d.data.column) + x.bandwidth())
            .attr('data-yloc-top', d => that.height - y(d[1]))
            .attr('data-yloc-bottom', d => that.height - y(d[0]))
            .attr('x', d => x(d.data.column))
            .attr('y', d => that.height)
            .attr('height', d => 0)
            .attr('width', x.bandwidth())
            .merge(that.bar)
            .transition(that.t)
            .ease(d3.easeExp)
            .attr('y', d => (y(d[1])))
            .attr("height", d => y(d[0]) - y(d[1]))
            .delay(that.delay);

        this.xAxis = d3.axisBottom()
            .scale(x)

        this.yAxis = d3.axisRight()
            .scale(y)
            .ticks(5)

        this.svg.selectAll('.axis--y').remove()

        // this.svg.append('g')
        //     .attr('class', 'axis axis--x')
        //     .classed('overview', true)
        //     .attr('transform', `translate(0,${height})`)
        //     .call(xAxis)

        this.svg.append('g')
            .attr('class', 'axis axis--y')
            .classed('overview', true)
            .attr('transform', `translate(${that.width},0)`)
            .call(that.yAxis)

        // create a list of keys
        // console.log(keys)

        // Usually you have a color scale in your chart already

        // d3.scaleOrdinal()
        //   .domain(keys)
        //   .range(d3.schemeSet1);

        // Add one dot in the legend for each name.

        // this.svg.append("g")
        //     .classed('axis', true)
        //     .classed('y--axis', true)
        //     .classed('overview', true)
        //     .call(d3.axisLeft(this.y));




    }

}

class EduStackedBarChart extends StackedBarChart {
    constructor(container_id) {
        super(container_id);
    }

    overview() {
        super.overview()
        let that = this
        let x1 = this.svg.select("g[data_label='" + that.labels[0] + "']").select('.stacked-bars').attr('data-xloc-right')
        let y1 = this.svg.select("g[data_label='" + that.labels[0] + "']").select('.stacked-bars').attr('data-yloc-top')

        let x2 = this.svg.select("g[data_label='" + that.labels[1] + "']").select('.stacked-bars').attr('data-xloc-left')
        let y2 = this.svg.select("g[data_label='" + that.labels[1] + "']").select('.stacked-bars').attr('data-yloc-top')

        this.svg.append("line")
            .classed('line-connector', true)
            .classed('overview', true)
            .attr("x1", x1)
            .attr("y1", that.height - y1)
            .attr("x2", x2)
            .attr("y2", that.height - y2)
            .attr("stroke-width", 2)
            .attr("stroke", "black");

        x1 = this.svg.select("g[data_label='" + that.labels[1] + "']").select('.stacked-bars').attr('data-xloc-right')
        y1 = this.svg.select("g[data_label='" + that.labels[1] + "']").select('.stacked-bars').attr('data-yloc-bottom')

        x2 = this.svg.select("g[data_label='" + that.labels[3] + "']").select('.stacked-bars').attr('data-xloc-left')
        y2 = this.svg.select("g[data_label='" + that.labels[3] + "']").select('.stacked-bars').attr('data-yloc-bottom')

        this.svg.append("line")
            .classed('line-connector', true)
            .classed('overview', true)

            .attr("x1", x1)
            .attr("y1", that.height - y1)
            .attr("x2", x2)
            .attr("y2", that.height - y2)
            .attr("stroke-width", 2)
            .attr("stroke", "black");


        x1 = this.svg.select("g[data_label='" + that.labels[1] + "']").select('.stacked-bars').attr('data-xloc-right')
        y1 = this.svg.select("g[data_label='" + that.labels[1] + "']").select('.stacked-bars').attr('data-yloc-top')

        x2 = this.svg.select("g[data_label='" + that.labels[4] + "']").select('.stacked-bars').attr('data-xloc-left')
        y2 = this.svg.select("g[data_label='" + that.labels[4] + "']").select('.stacked-bars').attr('data-yloc-top')

        this.svg.append("line")
            .classed('line-connector', true)
            .classed('overview', true)

            .attr("x1", x1)
            .attr("y1", that.height - y1)
            .attr("x2", x2)
            .attr("y2", that.height - y2)
            .attr("stroke-width", 2)
            .attr("stroke", "black");

    }
}
