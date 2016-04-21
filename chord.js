// From http://mkweb.bcgsc.ca/circos/guide/tables/

var width = 650,
    height = 650,
    outerRadius = Math.min(width, height) / 2 - 40,
    innerRadius = outerRadius - 20;

// var formatPercent = d3.format(".1%");

var arc = d3.svg.arc()
    .innerRadius(innerRadius)
    .outerRadius(outerRadius);

var layout = d3.layout.chord()
    .padding(.05)
    .sortSubgroups(d3.descending)
    .sortChords(d3.ascending);

var path = d3.svg.chord()
    .radius(innerRadius);

var svg = d3.select(".graphic")
    .attr("width", width)
    .attr("height", height)
  .append("g")
    .attr("id", "circle")
    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

svg.append("circle")
    .attr("r", outerRadius)
    .style("fill", "#fff");

queue()
    .defer(d3.csv, "data/cities.csv")
    .defer(d3.json, "data/matrix.json")
    .await(ready);

var color_gen = d3.scale.category20b();

function sublist(list, indices) {
    out = [];
    for (i in indices) {
        out.push(list[indices[i]]);
    }
    return out;
}

function submatrix(matrix, indices) {
    out = [];
    for (i in indices) {
        row = [];
        for (j in indices) {
            row.push(matrix[indices[i]][indices[j]]);
        }
        out.push(row);
    }
    return out;
}

var flags = [];
var g_cities, g_matrix;
var g_colors = {};

function activeIndices() {
    out = [];
    for (var i = 0; i < flags.length; i++) {
        if (flags[i] == 1) out.push(i);
    }
    return out;
}

function allOff() { console.log("Off"); for (i in flags) flags[i] = 0; $("#buttons .button").addClass("down"); render() }
function allOn() { console.log("On"); for (i in flags) flags[i] = 1; $("#buttons .button").removeClass("down"); render() }

function filter(cities, matrix, threshold = 0.01) {
    perCity = matrix.map( x => x.reduce( (a, b) => a + b ) )
    net = perCity.reduce( (a, b) => a + b );
    indices = [];
    for (i in cities) {
        if (perCity[i] >= threshold * net) indices.push(i);
    }
    return indices;
}

function ready(error, cities, matrix) {
    if (error) throw error;
    g_cities = cities;
    g_matrix = matrix;

    for (city in cities) flags.push(1);
    for (city in cities) g_colors[cities[city].name] = color_gen(city);

    d3.select("#buttons").selectAll("div")
        .data(cities)
        .enter().append("div")
        .attr("class", "btn-group")
        .attr("role", "group")
        .append("div")
        .attr("class", "button btn btn-default")
        .attr("type","button")
        .text(function(d) { return d.name })
        .on("click", function(g, i) { flags[i] = 1 - flags[i]; $(this).toggleClass("down"); render()})
        ;

    render();
}

function render() {
    svg.selectAll("g").remove();
    svg.selectAll(".chord").remove();
    cities = sublist(g_cities, activeIndices());
    matrix = submatrix(g_matrix, activeIndices());
    indices = filter(cities, matrix);
    cities = sublist(cities, indices);
    matrix = submatrix(matrix, indices);

    // Compute the chord layout.
    layout.matrix(matrix);

    var ticks = svg.append("g").selectAll("g")
        .data(layout.groups)
      .enter().append("g").selectAll("g")
        .data(groupTicks)
      .enter().append("g")
        .attr("transform", function(d) {
          return "rotate(" + (d.angle * 180 / Math.PI - 90) + ")"
              + "translate(" + outerRadius + ",0)";
        });


    // Add a group per neighborhood.
    var joined = svg.selectAll(".group")
        .data(layout.groups);
    var group = joined
        .enter().append("g")
        .attr("class", "group")
        .on("mouseover", fade(.1))
        .on("mouseout", fade(1));

    joined.exit().remove();

    // Add a mouseover title.
    group.append("title").text(function(d, i) {
      return cities[i].name + ": " + d.value + " origins";
    });

    // Add the group arc.
    var groupPath = group.append("path")
        .attr("id", function(d, i) { return "group" + i; })
        .attr("d", arc)
        .style("fill", function(d, i) { return g_colors[cities[i].name]; });

    // Add a text label.
    var groupText = group.append("text")
        .attr("x", 6)
        .attr("dy", 15)
        .style("fill","white");

    groupText.append("textPath")
        .attr("xlink:href", function(d, i) { return "#group" + i; })
        .text(function(d, i) { return cities[i].name; });

    // Remove the labels that don't fit. :(
    groupText.filter(function(d, i) { return groupPath[0][i].getTotalLength() / 2 - 40 < this.getComputedTextLength(); })
        .remove();

    // Add the chords.
    var chord = svg.selectAll(".chord")
        .data(layout.chords)
        .enter().append("path")
        .attr("class", "chord")
        .style("fill", function(d) { return g_colors[cities[d.source.index].name]; })
        .style("opacity", 1)
        .attr("d", path);

    // Add an elaborate mouseover title for each chord.
    chord.append("title").text(function(d) {
      return cities[d.source.index].name
          + " → " + cities[d.target.index].name
          + ": " + d.source.value + (
                  (d.source.index != d.target.index) ?
                  ( "\n" + cities[d.target.index].name
                    + " → " + cities[d.source.index].name
                    + ": " + d.target.value) :
                  ""
        );
    });

    ticks.append("line")
        .attr("x1", 1)
        .attr("y1", 0)
        .attr("x2", 5)
        .attr("y2", 0)
        .style("stroke", "#000");

    ticks.append("text")
        .attr("x", 8)
        .attr("dy", ".35em")
        .attr("transform", function(d) { return d.angle > Math.PI ? "rotate(180)translate(-16)" : null; })
        .style("text-anchor", function(d) { return d.angle > Math.PI ? "end" : null; })
        .text(function(d) { return d.label; });
}

// Returns an array of tick angles and labels, given a group.
function groupTicks(d) {
  var k = (d.endAngle - d.startAngle) / d.value;
  return d3.range(0, d.value, 5000).map(function(v, i) {
    return {
      angle: v * k + d.startAngle,
      label: i % 5 ? null : v / 1000 + "k"
    };
  });
}

// Returns an event handler for fading a given chord group.
function fade(opacity) {
  return function(g, i) {
    svg.selectAll(".chord")
        .filter(function(d) { return d.source.index != i && d.target.index != i; })
      .transition()
        .style("opacity", opacity);
  };
}

