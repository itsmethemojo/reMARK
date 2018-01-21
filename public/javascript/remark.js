function Remark(config)
{
    this.readConfig(config);
    this.initialize();
    this.listen();
}

Remark.prototype.readConfig = function (config) {
    this.apiUrl = config.apiUrl;
    this.containerDivId = config.containerDivId ? "#" + config.containerDivId : '#bookmarks';
    this.filterInputId = config.filterInputId ? "#" + config.filterInputId : '#filter';
    this.sortTypeSelectSelector = config.sortTypeSelectSelector ? config.sortTypeSelectSelector : 'input[type=radio][name=sortType]';
    this.firstEntriesCount = 30;
    this.wto = 0;
    this.filter = $(this.filterInputId).val();
    this.remarks = $(this.remarkSelectId).val();
    this.clicks = $(this.clickSelectId).val();
    this.bookmarks = localStorage.getObject("bookmarks") || new Array();
    this.bookmarksRemarked = localStorage.getObject("bookmarksSortedByRemarks") || new Array();
    this.bookmarksClicked = localStorage.getObject("bookmarksSortedByClicks") || new Array();
    this.maxCount = this.getUrlParameter("items");
    //TODO read it from select
    this.sortType = 'date';
}

Remark.prototype.listen = function () {
    var self = this;

    // react on filterfield typing
    $(self.filterInputId).on('input', function (event) {
        self.filter = $(this).val().toLowerCase().trim();

        clearTimeout(self.wto);
        self.wto = setTimeout(function () {
            self.printBookmarks();
        }, 500);
    });

    // react on changing sort type
    $(this.sortTypeSelectSelector).change(function() {
      self.setSortType(this.value);
      clearTimeout(self.wto);
      self.wto = setTimeout(function () {
          self.printBookmarks();
      }, 500);
    });
}

Remark.prototype.setSortType = function (sortType) {
  if(sortType === 'remarks' || sortType === 'clicks'){
    this.sortType = sortType;
  }
  else{
    this.sortType = 'date';
  }
}

Remark.prototype.initialize = function () {

    var width = window.innerWidth
                || document.documentElement.clientWidth
                || document.body.clientWidth;

    if (width < 600) {
        if (this.maxCount === null) {
            //TODO this does not work for more parameters
            console.log('width of ' + width + 'px seems to be a mobile device, so optimize printing by setting a limit');
            location.href = location.href = '?items=100';
        }
    }

    if (this.bookmarks.length !== 0) {
        //just print the old stuff at first
        this.printBookmarks();
    }
    this.refresh();
}

Remark.prototype.refresh = function () {
    console.log('refreshing');
    var self = this;
    var jsonUrl = self.apiUrl;
    $.getJSON(jsonUrl, function (bookmarks) {
        self.storeBookmarks(bookmarks);
        self.printBookmarks();
    }).fail(function (jqXHR) {
        if (jqXHR.status === 401) {
            self.login();
        }
    });
}

Remark.prototype.printBookmarks = function () {
    console.log('printing');
    var self = this;
    var html = "";
    var bookmarksHtmlCreated = 0;
    previousId = 0;
    bookmarks = self.getBookmarks();
    for (var i = 0; i < bookmarks.length; i++) {
        if (this.isBookmarkFiltered(bookmarks[i], i === 0 ? {"id": null} : bookmarks[previousId])) {
            continue;
        }
        if (self.maxCount !== null && self.maxCount == bookmarksHtmlCreated) {
            break;
        }
        bookmarksHtmlCreated++;
        if (bookmarksHtmlCreated === self.firstEntriesCount) {
            $(self.containerDivId).html('<table class="items">' + html + '</table>');
        }
        html += this.printBookmark(bookmarks[i]);
        previousId = i;
    }
    $(self.containerDivId).html('<table class="items">' + html + '</table>');
    $("td.title a").click(function () {
        $anker = $(this);
        $.getJSON(
            self.apiUrl + "click/" + $anker.closest("tr").data("id") + "/",
            function (result) {
                self.refresh();
            }
        );
    });

}

Remark.prototype.printBookmark = function (bookmark) {

    var fourDivs = '<div></div><div></div><div></div><div></div>';
    return '<tr data-id="' + bookmark['id'] + '">' +
            '<td class="date">' + this.extractDate(bookmark['created']) + '</td>' +
            '<td class="time">' + this.extractTime(bookmark['created']) + '</td>' +
            '<td class="icon"><div class="icon remark level' + this.getRemarkVisibility(bookmark['remarks']) + '">' + fourDivs + '</div></td>' +
            '<td class="icon"><div class="icon click level' + this.getClickVisibility(bookmark['clicks']) + '">' + fourDivs + '</div></td>' +
            '<td class="title">' +
            '<a target="_blank" href="' + bookmark['url'] + '">' +
            (bookmark['customtitle'] === "" ? bookmark['title'] : bookmark['customtitle']) +
            '</a></td>' +
            '</tr>' +
            '<tr>' +
            '<td colspan="4"></td>' +
            '<td class="domain">' + bookmark['domain'] + '</td>' +
            '</tr>';

}

Remark.prototype.storeBookmarks = function (bookmarks) {
  var self = this;
  self.bookmarks = bookmarks;
  localStorage.setObject("bookmarks", self.bookmarks);

  //sort bookmarks
  var remarkHighCount = 0;
  var clickedHighCount = 0;
  for (var i = 0; i < self.bookmarks.length; i++) {
    if(bookmarks[i]['remarks'] > remarkHighCount){
      remarkHighCount = bookmarks[i]['remarks'];
    }
    if(bookmarks[i]['clicks'] > clickedHighCount){
      clickedHighCount = bookmarks[i]['clicks'];
    }
  }

  var sortedRemarkedEntries = [];
  var sortedClickedEntries = [];

  var alreadyRemarkedEntries = new Map();
  var alreadyClickedEntries = new Map();

  for (var j = ((remarkHighCount > clickedHighCount) ? remarkHighCount : clickedHighCount); j >= 0; j--) {
    //console.log(j);
    for (var i = 0; i < self.bookmarks.length; i++) {
    //console.log('qasdas');
      if(bookmarks[i]['remarks'] == j && !alreadyRemarkedEntries.has(bookmarks[i]['id'])){
        sortedRemarkedEntries.push(bookmarks[i]);
        alreadyRemarkedEntries.set(bookmarks[i]['id']);

      }
      if(bookmarks[i]['clicks'] == j && !(alreadyClickedEntries.has(bookmarks[i]['id']))){
        sortedClickedEntries.push(bookmarks[i]);
        alreadyClickedEntries.set(bookmarks[i]['id']);
      }
    }
  }

  this.bookmarksRemarked = sortedRemarkedEntries;
  this.bookmarksClicked = sortedClickedEntries;
  localStorage.setObject("bookmarksSortedByRemarks", this.bookmarksRemarked);
  localStorage.setObject("bookmarksSortedByClicks", this.bookmarksClicked);
}

Remark.prototype.getBookmarks = function () {
  switch(this.sortType){
    case 'date':
      return this.bookmarks;
    case 'remarks':
      return this.bookmarksRemarked;
    case 'clicks':
      return this.bookmarksClicked;
  }

  return new Array();
}

Remark.prototype.isBookmarkFiltered = function (bookmark, lastBookmark) {
    if (lastBookmark['id'] === bookmark['id']) {
        return true;
    }

    if (this.remarks !== "" && this.remarks !== "=0" && this.remarks > bookmark['remarks']) {
        return true;
    }

    if (this.remarks === "=0" && bookmark['remarks'] > 0) {
        return true;
    }

    if (this.clicks !== "" && this.clicks !== "=0" && this.clicks > bookmark['clicks']) {
        return true;
    }

    if (this.clicks === "=0" && bookmark['clicks'] > 0) {
        return true;
    }


    if (this.filter === "") {
        return false;
    }

    //determine if single or multi term
    if (-1 === this.filter.indexOf(" ")) {
        if (
                -1 !== bookmark['title'].toLowerCase().indexOf(this.filter)
                || -1 !== bookmark['customtitle'].toLowerCase().indexOf(this.filter)
                || -1 !== bookmark['url'].toLowerCase().indexOf(this.filter)
                ) {
            return false;
        }
    } else {
        var searchTerms = this.filter.split(" ");
        for (var i = 0; i < searchTerms.length; i++) {
            if (searchTerms[i] === "") {
                continue;
            }
            if (
                    -1 === bookmark['title'].toLowerCase().indexOf(searchTerms[i])
                    && -1 === bookmark['customtitle'].toLowerCase().indexOf(searchTerms[i])
                    && -1 === bookmark['url'].toLowerCase().indexOf(searchTerms[i])
                    ) {
                return true;
            }
        }
        return false
    }


    return true;
}

Remark.prototype.extractDate = function (unixTimestamp) {
    var a = new Date(unixTimestamp * 1000);
    var year = a.getFullYear();
    var month = a.getMonth() < 9 ? "0" + (a.getMonth() + 1) : (a.getMonth() + 1);
    var date = a.getDate() < 10 ? "0" + a.getDate() : a.getDate();
    return date + "." + month + "." + year;
}

Remark.prototype.extractTime = function (unixTimestamp) {
    var a = new Date(unixTimestamp * 1000);
    var hour = a.getHours() < 10 ? "0" + a.getHours() : a.getHours();
    var minute = a.getMinutes() < 10 ? "0" + a.getMinutes() : a.getMinutes();
    return hour + ":" + minute;
}

Remark.prototype.getRemarkVisibility = function (count) {
    switch (parseInt(count)) {
        case 0:
            return 0;
        case 1:
            return 0;
        case 2:
            return 2;
        case 3:
            return 4;
        case 4:
            return 6;
    }
    return 8;
}

Remark.prototype.getClickVisibility = function (count) {
    switch (parseInt(count)) {
        case 0:
            return 0;
        case 1:
            return 1;
        case 2:
            return 2;
        case 3:
            return 3;
    }
    if (count <= 6) {
        return 4;
    }
    if (count <= 10) {
        return 5;
    }
    if (count <= 15) {
        return 6;
    }
    if (count <= 20) {
        return 7;
    }

    return 8;
}

Remark.prototype.login = function () {
    //no authorization -> no bookmarks cache
    console.log("not logged in");
    this.storeBookmarks([]);
    window.location.href = "login.php";
}

Remark.prototype.getUrlParameter = function (key) {
    var regexS = "[\\?&]"+key+"=([^&#]*)";
    var regex = new RegExp(regexS);
    var results = regex.exec(location.href);
    return results == null ? null : results[1];
}

Storage.prototype.setObject = function (key, value) {
    this.setItem(key, JSON.stringify(value));
}

Storage.prototype.getObject = function (key) {
    return JSON.parse(this.getItem(key));
}
