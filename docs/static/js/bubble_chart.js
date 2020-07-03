class BubbleChart extends RegionStatsBarChart {
    constructor(container_id) {
        super(container_id);
        this.selected_bubble = null;
        this.t = d3.transition().duration(750);
        this.delay = function(d, i) {
            return i * 60;
        };
    }

    loadData() {
        this.log('loading data')
        let that = this

        d3.csv(this.url, function(error, data) {
            if (error) throw error;
            that.raw_data = data;
            that.labels = toLabels(data);
            that.label_map = toLabelMap(that.labels);
            that.data_tidy = that.toTidy(data, that.labels);
            that.draw_overview();

        });
    }

    overview() {
        this.state = 'overview';
        let that = this;
        this.data = this.data_tidy.filter(d => (d.region == REGION) && (d.demographic == 'All'));
        this.checkData(this.data)
        this.data
            .forEach(
                function (d) {
                    d.hasBreakdown = that.checkIfBreakdown(d);
                }
            );
        let data = this.data;
    
        let margin = { top: 25, right: 20, bottom: 25, left: 20 };
        let width = this.container_width - margin.left - margin.right;

        let max_bubble_dia = (width / data.length) * 0.98;
        let height = max_bubble_dia * 1.05;
        let max_bubble_area = Math.PI * Math.pow(max_bubble_dia / 2, 2);
        let min_bubble_area = Math.PI * Math.pow(10, 2); // 10 px radius
        let max_data_value = d3.max(this.data_tidy.filter(d => d.demographic == 'All'), d => d.value)

        this.svg = this.container.select("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .select("g")
            .attr("transform",
                "translate(" + margin.left + "," + margin.top + ")");

        this.svg.selectAll(".breakdown").remove();

        // set the x range
        this.x = d3.scaleBand()
            .range([0, width])

        this.x.domain(data.map(d => that.label_map[d.label].label_short))

        let bubbles = this.svg.selectAll(".bar-g")

        if (bubbles.empty()) {
            bubbles = this.svg.append('g')
                .classed('bar-g', true)
                .classed('overview', true);
        }

        data.forEach(function(d) {
            d.radius = Math.sqrt(map_range(d.value, 0, max_data_value, min_bubble_area, max_bubble_area) / Math.PI);
            d.cx = that.x(that.label_map[d.label].label_short) + that.x.bandwidth() / 2;
            d.area = Math.PI * d.radius * d.radius;
            d.scaler = .6 * d.radius * 2;
        })

        let bubble = bubbles.selectAll('.bubble')
            .data(data)

        bubble.exit().remove();

        var show_tooltip = this.tooltip_show.bind(this)
        var move_tooltip = this.tooltip_move.bind(this)
        var hide_tooltip = this.tooltip_hide.bind(this)
        var on_touch = this.on_touch.bind(this)
        var goto = this.breakdown.bind(this);

        bubble.enter().append("circle")
            .attr("data_label", d => d.label)

            .classed('overview', true)
            .classed('bubble', true)
            
            .attr("cx", d => d.cx)
            .attr('cy', height - height / 2)
            .attr('r', 0)
            .attr('fill-opacity', 0.0)
            .merge(bubble)
            .on('touchstart touchend click mouseover mousemove mouseout', function(d) {

                if (d3.event.type == 'touchstart') {
                    d3.event.preventDefault();
                    d3.event.stopPropagation();
                    that.selected_bar = that.selected_bubble = d3.select(this).attr('data_label');
                    that.breakdownTitleColor = d3.select(this).attr('fill');
                    return on_touch(d);

                } else if (d3.event.type == 'touchend') {
                    d3.event.preventDefault();
                    d3.event.stopPropagation();
                    return false;

                } else if (d3.event.type == 'click') {
                    hide_tooltip(d);
                    that.selected_bar = that.selected_bubble = d3.select(this).attr('data_label');
                    that.breakdownTitleColor = d3.select(this).attr('fill');
                    return goto();
                } else if (d3.event.type == "mouseover") {
                    return show_tooltip(d);
                } else if (d3.event.type == "mousemove") {
                    return move_tooltip(d);
                } else if (d3.event.type == "mouseout") {
                    return hide_tooltip(d);
                }
            })
            .interrupt()
            .transition(that.t)
            .ease(d3.easeExp)
            .attr('r', d => d.radius)
            .attr("cx", d => d.cx)
            .attr('cy', height - height / 2)
            .attr('fill', d3.color(that.color || "steelblue"))
            .attr('fill-opacity', 1)
            .delay(that.delay);

        bubbles.selectAll('.bubble').classed('has-breakdown', d=>d.hasBreakdown)

        let icons = bubbles.selectAll('.icon')
            .data(data)

        icons.exit().remove();

        icons.enter()
            .append("svg:image")
            .classed('icon', true)
            .classed('overview', true)
            .style("pointer-events", "none")
            .attr('xlink:href', (d, i) => that.icon_urls[i])
            .attr('x', d => d.cx - d.scaler / 2)
            .attr('y', d => (height - height / 2) - d.scaler / 2)
            .attr('width', d => d.scaler)
            .attr('height', d => d.scaler)
            .merge(icons)
            .interrupt()
            .transition(that.t)
            .ease(d3.easeExp)
            .attr('x', d => d.cx - d.scaler / 2)
            .attr('y', d => (height - height / 2) - d.scaler / 2)
            .attr('width', d => d.scaler)
            .attr('height', d => d.scaler)
            .delay(that.delay)




        // let value_labels = bubbles.selectAll(".value")
        //     .data(data);

        // value_labels.exit().remove();

        // value_labels.enter().append("text")
        //     .attr("class", "value")
        //     .classed('overview', true)
        //     .attr("fill", "white")
        //     .attr("fill-opacity", 0)
        //     .attr("x", d => that.x(that.label_map[d.label].label_short) + that.x.bandwidth() / 2)
        //     .attr("y", height - height / 2)
        //     .attr("dy", "0.35em") //vertical align middle
        //     .attr("text-anchor", "middle")
        //     .merge(value_labels)
        //     .interrupt()
        //     .transition(this.t)
        //     .attr("fill-opacity", 1)
        //     .attr("x", d => that.x(that.label_map[d.label].label_short) + that.x.bandwidth() / 2)
        //     .attr('y', height - height / 2)

        //     .attr("font-size", d => Math.min(0.45 * d.radius, 18))
        //     .text(d => this.labelFormatter(d.value))
        //     .delay(this.delay);

        let text_labels = bubbles.selectAll(".text-labels")
            .data(data);

        text_labels.exit().remove();
        let max_text_height = -1

        // TODO label wrapping is broken

        text_labels.enter().append("text")
            .classed("text-labels", true)
            .classed('overview', true)
            .attr("fill", " white")
            .attr("opacity", 0)
            .attr("x", d => that.x(that.label_map[d.label].label_short) + that.x.bandwidth() / 2)
            .attr("font-size", Math.min(18, 250 * 0.95))
            .text(d => that.label_map[d.label].label_short)
            .merge(text_labels)
            .interrupt()
            .transition(this.t)
            .ease(d3.easeExp)
            .attr("opacity", 1)
            .attr("text-anchor", "middle")
            .attr("alignment-baseline", "top")
            .attr('fill', d3.color(that.color || "rgb(51, 51, 51)"))

            .attr("x", d => that.x(that.label_map[d.label].label_short) + that.x.bandwidth() / 2)
            .attr("y", d => (height - height / 2) + d.radius + 25)
            .attr('dy', "1.1em")
            .delay(this.delay)
            .each(insertLinebreaks)
            .each(function(d) {
                let _h = this.getBBox().height;
                max_text_height = _h > max_text_height ? _h : max_text_height;
            })
            .selectAll('text,tspan')
            .attr("x", d => that.x(that.label_map[d.label].label_short) + that.x.bandwidth() / 2)

        // resize for label wraps.
        this.container.select('svg').attr("height", height + margin.top + Math.max(margin.bottom, max_text_height * 1.15))
    }
}
