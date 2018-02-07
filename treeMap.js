var mapView;
var highlightLayer;
var treelayer;
var timeoutID;
var mySwiper;
var slideIndex = {};
var speciesBios = {};
require([
        "esri/Map",
        "esri/views/MapView",
        "esri/layers/FeatureLayer",
        "esri/geometry/Extent",
        "esri/geometry/SpatialReference",
        "esri/widgets/BasemapToggle",
        "esri/widgets/Home",
        "esri/widgets/Track",
        "esri/layers/GraphicsLayer",
        "esri/Graphic",
        "esri/geometry/Point",
        "esri/symbols/SimpleMarkerSymbol",
        "esri/Viewpoint",
        "esri/tasks/QueryTask",
        "esri/tasks/support/Query",
        "dojo/domReady!"
    ],

    function(Map, MapView, FeatureLayer, Extent, SpatialReference, BasemapToggle, Home, Track, GraphicsLayer, Graphic, Point, SimpleMarkerSymbol, Viewpoint, QueryTask, Query) {

        // new $.fn.dataTable.FixedHeader( table );
        $("#mapView").css("bottom", $(".swiper-container").height())
        $("#infoPanel").height($("#mapView").height());
        $("#infoDesc").height($(".swiper-container").offset().top - $("#infoDesc").offset().top);
        // Create the Map with an initial basemap
        var map = new Map({
            basemap: "satellite"
        });
        // startExtent = new Extent(-13043147, 4036899, -13042121,
        //     4037754, new SpatialReference({
        //         wkid: 3857
        //     }));

        highlightLayer = new GraphicsLayer();
        treeLayer = new FeatureLayer({
            url: "https://urspatial.redlands.edu/ags/rest/services/CampusTrees/FeatureServer/0",
            outFields: ["*"]
        });
        map.add(highlightLayer);
        map.add(treeLayer);


        // Create the MapView and reference the Map in the instance
        mapView = new MapView({
            container: "mapView",
            map: map
        });
        //mapView.center = [-13042637, 4037324];
        mapView.center = [-117.164673, 34.063830];
        mapView.zoom = 16;
        mapView.then(function() {
            return treeLayer.then(function() {
                var query = treeLayer.createQuery();
                query.where = "NOT CommonName is null"
                query.outFields = ["CityManaged", "Comments", "SurveyDate", "SpeciesCode", "ScientificName", "CommonName", "Tree_Type", "SppValueAssignment", "Height", "CanopySize", "SpeciesType"];

                return treeLayer.queryFeatures(query);
            });
        }).then(getSpecies).then(initializeSwiper).then(getBios);

        // 1 - Create the widget
        var toggle = new BasemapToggle({
            // 2 - Set properties
            view: mapView, // view that provides access to the map's 'topo' basemap
            nextBasemap: "topo" // allows for toggling to the 'hybrid' basemap
        });

        // Add widget to the top right corner of the view
        mapView.ui.add(toggle, "top-right");
        var homeBtn = new Home({
            view: mapView
        });

        // Add the home button to the top left corner of the view
        mapView.ui.add(homeBtn, "top-left");
        var track = new Track({
            view: mapView
        });
        mapView.ui.add(track, "top-left");
        mapView.on("click", function(event) {
            mapView.hitTest(event)
                .then(function(response) {
                    // do something with the result graphic
                    var graphic = response.results[0].graphic;
                    var comName = graphic.attributes.CommonName;
                    var sciName = graphic.attributes.ScientificName;
                    selectSpecies(sciName, comName, false);
                    if (typeof(slideIndex[comName]) != "undefined") {
                        mySwiper.slideTo(slideIndex[comName]);
                        // $(".selected").removeClass("selected");
                        // $(".swiper-slide[data-comName='" + comName + "']").addClass("selected");

                    }
                    var vpoint = new Viewpoint({
                        targetGeometry: response.screenPoint.mapPoint,
                        scale: 564
                    });
                    mapView.goTo(vpoint);
                    console.log(comName + " - " + slideIndex[comName])
                        //alert(graphic.attributes.CommonName);
                });
        });
        $(window).resize(function() {
            $(".swiper-slide").width($(".swiper-slide").height() * 1.33);
            $("#mapView").css("bottom", $(".swiper-container").height());
            $("#infoPanel").css("top", $("#mapView").css("top"));

            $("#infoPanel").css("bottom", $("#mapView").css("bottom"));
            $("#infoDesc").height($(".swiper-container").offset().top - $("#infoDesc").offset().top);
            //$("#speciesInfo").css("bottom",$("#mapView").css("bottom"));
        });

        function zoomToSelection() {
            var features = highlightLayer.graphics.items;
            var minX, minY, maxX, maxY;



            if (features.length == 1) {
                mapView.goTo(features);
                if (mapView.zoom > 19) {
                    mapView.zoom = 19;
                }
            } else {
                for (i = 0; i < features.length; i++) {
                    var feature = features[i];
                    if (minX == null || minX < feature.geometry.longitude) {
                        minX = feature.geometry.longitude
                    }
                    if (minY == null || minY < feature.geometry.latitude) {
                        minY = feature.geometry.latitude
                    }
                    if (maxX == null || maxX > feature.geometry.longitude) {
                        maxX = feature.geometry.longitude
                    }
                    if (maxY == null || maxY > feature.geometry.latitude) {
                        maxY = feature.geometry.latitude
                    }
                }
                var treeExtent = new Extent({ xmin: minX, ymin: minY, xmax: maxX, ymax: maxY, spatialReference: 4326 });
                mapView.goTo(treeExtent.expand(4)).then(function() {
                    if (mapView.zoom > 19) {
                        mapView.zoom = 19;
                    }
                });;
            }
        }


        function highlightSelection(results) {
            highlightLayer.removeAll();
            var features = results.features.map(function(graphic) {
                graphic.symbol = new SimpleMarkerSymbol({
                    style: "circle",
                    size: 12,
                    color: [255, 255, 0, .8]
                });
                return graphic;
            });
            highlightLayer.addMany(features);

            //mapView.goTo(features);


        }

        function getBios(response) {
            var queryBios = new QueryTask({
                url: "https://urspatial.redlands.edu/ags/rest/services/CampusTrees/FeatureServer/1"
            });
            var query = new Query();
            query.where = "1=1";
            queryBios.execute(query).then(function(result) {
                for (i = 0; i < result.features.length; i++) {
                    speciesBios[result.features[i].attributes.CommonName] = result.features[i].attributes;
                }

            });


        }

        function getSpecies(response) {
            var trees = response.features;
            var uniqueList = [];
            var species = [];

            for (i = 0; i < trees.length; i++) {
                var tree = trees[i];

                if (tree.attributes.ScientificName == null) {
                    continue;
                }
                if (tree.attributes.CommonName.startsWith("Coast")) {
                    console.log("clo");
                }
                if (uniqueList.indexOf(tree.attributes.ScientificName) == -1) {
                    uniqueList.push(tree.attributes.ScientificName);
                    species.push({ "scientificName": tree.attributes.ScientificName, "count": 1, "commonName": tree.attributes.CommonName });
                } else {
                    for (j = 0; j < species.length; j++) {
                        var s = species[j];
                        if (s.scientificName == tree.attributes.ScientificName) {
                            s.count++;
                        }
                    }
                }

            }
            //species.sort(function(a, b) { return b.count - a.count; });
            species.sort(function(a, b) { return (a.commonName > b.commonName) ? 1 : ((b.commonName > a.commonName) ? -1 : 0); });

            for (j = 0; j < species.length; j++) {

                var tree = species[j];
                slideIndex[tree.commonName] = j;
                $(".swiper-wrapper").append('<div class="swiper-slide" data-comName = "' + tree.commonName + '" data-sciName="' + tree.scientificName + '"style=""><div class="treeInfo">' + tree.commonName + ' <i>(' + tree.scientificName + ')</i ><br>' + tree.count + ' on campus</div ></div > ');

                var imgURL = "photos/thumbs/" + replaceAll(tree.commonName, " ", "") + ".jpg";
                var img = new Image();
                img["data-imgURL"] = imgURL;
                img["data-comName"] = tree.commonName;
                img.onload = function(i) {

                    //$("#infoPhoto").css("background-image", "url(" + imgURL + ")");
                    $(".swiper-slide[data-comName='" + i.target["data-comName"] + "']").css("background-image", "url(" + i.target["data-imgURL"] + ")");
                }
                img.onerror = function(e) {
                        $(".swiper-slide[data-comName='" + e.target["data-comName"] + "']").css("background-image", "url(photos/thumbs/placeholder.png)");

                        //img.src = "photos/thumbs/placeholder.png"
                    }
                    //$("#infoPhoto").css("background-image", "url(http://lorempixel.com/284/213/nature)");
                img.src = imgURL;
            }
            $(".swiper-slide").width($(".swiper-slide").height() * 1.33);
            $("#closeButton").click(function() { hideInfoPanel() });
            $(".swiper-slide").click(function() {
                var sciName = $(this).data("sciname");
                var comName = $(this).data("comname");

                selectSpecies(sciName, comName, true);

            });
        }

        function selectSpecies(sciName, comName, zoom = true) {
            $(".selected").removeClass("selected");
            $(".swiper-slide[data-comName='" + comName + "']").addClass("selected");
            mySwiper.stopAutoplay();
            fillInfo(sciName, comName);

            showInfoPanel();
            if (timeoutID != null || typeof(timeoutID) != "undefined") {
                window.clearTimeout(timeoutID);
            }
            timeoutID = window.setTimeout(function() { mySwiper.startAutoplay(); }, 10000)

            //alert(sciName);
            var query = treeLayer.createQuery();
            query.where = "ScientificName = '" + sciName + "'";
            treeLayer.queryFeatures(query).then(highlightSelection).then(function() {
                if (zoom) {
                    zoomToSelection();
                }
            }).then(function() {
                treeLayer.opacity = 0.6;
            });

        }

        function fillInfo(scientific, common) {
            $("#infoComName").text(common);
            $("#infoSciName").text(scientific);
            var bio = "";
            if (typeof(speciesBios[common]) != "undefined") {
                bio = speciesBios[common].Bio;
                $("#infoDesc").text(bio);
                if (speciesBios[common].MoreInfo != null && speciesBios[common].MoreInfo != "") {
                    $("#infoDesc").append("<br><a href='" + speciesBios[common].MoreInfo + "' data-lity>Click here for more info</a>");
                }
                $("#infoDesc").show();
            } else {
                $("#infoDesc").hide();
            }


            var imgURL = "photos/thumbs/" + replaceAll(common, " ", "") + ".jpg";
            var img = new Image();
            img.onload = function() {
                $("#infoPhoto").css("background-image", "url(" + imgURL + ")");
            }
            img.onerror = function() {
                    $("#infoPhoto").css("background-image", "url(photos/thumbs/placeholder.png)");
                    //img.src = "photos/thumbs/placeholder.png"
                }
                //$("#infoPhoto").css("background-image", "url(http://lorempixel.com/284/213/nature)");
            img.src = imgURL;
            $("#infoDesc").height($(".swiper-container").offset().top - $("#infoDesc").offset().top);
        }

        function initializeSwiper() {
            mySwiper = new Swiper('.swiper-container', {
                // Optional parameters
                direction: 'horizontal',
                loop: true,

                // If we need pagination
                pagination: '.swiper-pagination',
                grabCursor: true,
                // Navigation arrows
                nextButton: '.swiper-button-next',
                prevButton: '.swiper-button-prev',

                // And if we need scrollbar
                // scrollbar: '.swiper-scrollbar',
                // pagination: '.swiper-pagination',
                freeModeMomentum: true,
                freeMode: true,
                effect: 'slide',
                // grabCursor: true,
                centeredSlides: true,
                slidesPerView: 'auto',
                spaceBetween: 40,
                // coverflow: {
                //     rotate: 50,
                //     stretch: 0,
                //     depth: 100,
                //     modifier: 1,
                //     slideShadows : true
                // },
                autoplay: 5000,
                autoplayDisableOnInteraction: false
            });
        }
    });


function showInfoPanel() {
    $("#infoPanel").addClass("slideout");
    $("#mapView").addClass("info");
}

function hideInfoPanel() {
    $("#infoPanel").removeClass("slideout");
    $("#mapView").removeClass("info");
    highlightLayer.removeAll();
    treeLayer.opacity = .9;
}

function replaceAll(str, find, replace) {
    return str.replace(new RegExp(find, 'g'), replace);
}