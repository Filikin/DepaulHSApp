var buildingUploadQueue = 'BuildingUploadQueue';
var buildingLocalRecords = 'BuildingChecks';
var currentBuildingChecks;

function BuildingChecks ()
{
}

BuildingChecks.prototype.clearRecords = function ()
{
	sfSmartstore.removeSoup(buildingUploadQueue,
            function(param){}, 
            function(param){});
	sfSmartstore.removeSoup(buildingLocalRecords,
            function(param){}, 
            function(param){});
}

/**
 * load records for the app
 **/
BuildingChecks.prototype.loadRecords = function(error) {
//	console.log("BuildingChecks.prototype.loadRecords");
	var that = this;
	var $j = jQuery.noConflict();
	var interval = setTimeout(function(){
		        $j.mobile.loading('show', {
		        	text: 'Loading Building Checks',
		        	textVisible: true,
		        	theme: 'a',
		        	html: ""
		        });
		    },1);  
	sfSmartstore.soupExists(buildingLocalRecords,function(param){
		if(Util.checkConnection()){
			that.loadRecordsFromSalesforce(false,error);
		}
		else {
			that.loadRecordsFromSmartstore(that.onNoRecords);
		}
	},error);
}

BuildingChecks.prototype.onNoRecords = function () {
	alert ('Not online and no local Building Checks found');
	var $j = jQuery.noConflict();
	var interval = setTimeout(function(){
		$j.mobile.loading('hide');
	},1);      
}

/**
 * Store Records
 **/
BuildingChecks.prototype.storeRecords = function(records,error){
//	console.log('BuildingChecks.prototype.storeRecords ' + records.length + ' records');
	sfSmartstore.upsertSoupEntries(buildingLocalRecords,records, function(){
//		console.log("Soup Upsert Success");        
	}, error);

}

/**
 * load records from salesforce
 **/
BuildingChecks.prototype.loadRecordsFromSalesforce = function(error) 
{
	if (debugMode) logToConsole("BuildingChecks.prototype.loadRecordsFromSalesforce");
	var that = this;
	//check if we're online
	if(Util.checkConnection())
	{
		if (debugMode) logToConsole('We are online...');
      // PUSH QUEUE TO SFDC
		OfflineQueue.UploadQueue(buildingUploadQueue, function()
		{
			that.clearRecords(); // clear out the old records
			if (debugMode) logToConsole('We are online... querying SFDC');
            // QUERY FROM SALESFORCE USING FORCETK
	        var timeNow = new Date();
	        var nextHourStarts;
	        var nextHourEnds;
	        if (timeNow.getMinutes() > (60 - Item_check_minutes_before_hour)) nextHourStarts = new Date (timeNow.getFullYear(), timeNow.getMonth(), timeNow.getDate(), timeNow.getHours()+1, 0, 0, 0);
	        else nextHourStarts = new Date (timeNow.getFullYear(), timeNow.getMonth(), timeNow.getDate(), timeNow.getHours(), 0, 0, 0);
	        nextHourEnds = new Date (timeNow.getFullYear(), timeNow.getMonth(), timeNow.getDate(), timeNow.getHours(), timeNow.getMinutes() + Show_item_checks_in_future_minutes, 0, 0);

			forcetkClient.query("SELECT Id, SortKey__c, Name, Area__c, Area_Item_Name__c, Time_of_Check__c, Time_to_display_on_phone__c, Result__c, Type_of_Hazard__c, Item_Check_Comment__c, Current_Status_of_Item__c from Item_Check__c where Area_Item__r.Building__c = '" + building + "' and Time_of_Check__c >= " + nextHourStarts.toJSON() + " and Time_of_Check__c <= " + nextHourEnds.toJSON() + " order by SortKey__c limit 500", function(response)
			{  
                that.registerBuildingSoup(function(){
					that.storeRecords(response.records,error);
				},error);
				that.onSuccessSfdcBuildingChecks(response.records);
			}, error); 
		},error);
	}
	else 
	{
		if (debugMode) logToConsole('ERROR: Not online and no local records exist');
	}
}

/**
 * Load records from Smartstore
 **/
BuildingChecks.prototype.loadRecordsFromSmartstore = function(error){
//	console.log("BuildingChecks.prototype.loadRecordsFromSmartstore");
	var that=this;
    //DF12 DEMO 11 QUERY SMARTSTORE

    var querySpec = sfSmartstore.buildAllQuerySpec("SortKey__c", "ascending", 2000);
        
    sfSmartstore.querySoup(buildingLocalRecords, querySpec,
                                  function(cursor) { that.onSuccessQuerySoup(cursor); },
                                  error);
}

/**
 * Load record with Id from Smartstore
 **/
BuildingChecks.prototype.loadRecordWithIdFromSmartstore = function(Id,callback,error){
//  	console.log("BuildingChecks.prototype.loadRecordWithIdFromSmartstore id is: " + Id);
	var that = this;
	var querySpec = sfSmartstore.buildExactQuerySpec("Id", Id, 2000);
	sfSmartstore.querySoup(buildingLocalRecords, querySpec,
                                  function(cursor) { 
                                      var records = [];
                                      records = Util.LoadAllRecords(cursor,records);
                                     callback(records);
                                  },
                                  error);
}

/**
 * Update an entry changed by the user
 **/
BuildingChecks.prototype.updateRecord = function(fieldData,error) {
//	console.log('BuildingChecks.prototype.updateRecord');
	var that=this;
	that.loadRecordWithIdFromSmartstore(fieldData.Id,function(records)
	{
		records[0].Result__c = fieldData.Result__c;
		records[0].Item_Check_Comment__c = fieldData.Item_Check_Comment__c;
		if (fieldData.Result__c == 'Hazard') records[0].Type_of_Hazard__c = fieldData.Type_of_Hazard__c;
		else records[0].Type_of_Hazard__c = '';
		that.storeRecords(records,error);
		// SAVE TO SALESFORCE IF ONLINE
		if(Util.checkConnection()) 
		{
			forcetkClient.update('Item_Check__c', fieldData.Id,{"Result__c":fieldData.Result__c, "Item_Check_Comment__c":fieldData.Item_Check_Comment__c, "Type_of_Hazard__c":fieldData.Type_of_Hazard__c},function(){
//				console.log('SFDC Update Success!');
			},error);
		}
		else
		{
			OfflineQueue.QueueRecords(buildingUploadQueue, records, error);
		}
	},error);
 }

/**
 * Register the soup if it doesn't already exist
 **/
BuildingChecks.prototype.registerBuildingSoup = function(callback,error){
//	console.log('BuildingChecks.prototype.registerSoup');
	//check if the Item_Check__c soup exists
	sfSmartstore.soupExists(buildingLocalRecords,function(param){
		if(!param){
			//Item_Check__c soup doesn't exist, so let's register it
			var indexSpec=[{"path":"Id","type":"string"},{"path":"SortKey__c","type":"string"}];
			sfSmartstore.registerSoup(buildingLocalRecords,indexSpec,function(param){
//				console.log(buildingLocalRecords + ' Soup Created: '+param);
				callback();
			},error);
		}
		else {
			callback();
		}
	},error);
}

//Load the data for a specific category, based on
//the URL passed in. Generate markup for the items in the
//category, inject it into an embedded page, and then make
//that page the current active page.
function showArea( urlObj, options )
{
	var $j = jQuery.noConflict();
	if (debugMode) logToConsole ('In showArea, urlObj: ' + urlObj.hash);
	var categoryName = urlObj.hash.replace( /.*area=/, "" );

		// Get the object that represents the category we
		// are interested in. Note, that at this point we could
		// instead fire off an ajax request to fetch the data, but
		// for the purposes of this sample, it's already in memory.
	var	checkMap = currentBuildingChecks[ categoryName ];

		// The pages we use to display our content are already in
		// the DOM. The id of the page we are going to write our
		// content into is specified in the hash before the '?'.
	var	pageSelector = urlObj.hash.replace( /\?.*$/, "" );
	
	if (checkMap) 
	{
		// Get the page we are going to dump our content into.
		var $page = $j( pageSelector );

			// Get the header for the page.
		var	$header = $page.children( ":jqmData(role=header)" );

			// Get the content area element for the page.
		var	$content = $page.children( ":jqmData(role=content)" );

		var i=0;
		var markup = '<ul data-role="listview" id="div_building_check_list">';
		
		for (var oneCheck in checkMap)
		{
			if (i==0) $header.find( "h1" ).html( checkMap[oneCheck].Area__c );
			markup += displayOneCheck (i++, checkMap[oneCheck]);
		}
		markup += "</ul>";
		$content.html( markup );
		
	   	i=0;
		for (var oneCheck in checkMap)
		{
			itemChecks.addClickHandlersToList (i++, checkMap[oneCheck]);
	    }

	   	if (debugMode) logToConsole('One Area HTML before: ' + $page.html());
		// Pages are lazily enhanced. We call page() on the page
		// element to make sure it is always enhanced before we
		// attempt to enhance the listview markup we just injected.
		// Subsequent calls to page() are ignored since a page/widget
		// can only be enhanced once.
		$page.page();

	   	if (debugMode) logToConsole('One Area HTML mid: ' + $page.html());

	   	// Enhance the listview we just injected.
	   	$j( "#div_bl" ).trigger("create");

	   	if (debugMode) logToConsole('One Area HTML after: ' + $page.html());

	   	// We don't want the data-url of the page we just modified
		// to be the url that shows up in the browser's location field,
		// so set the dataUrl option to the URL for the category
		// we just loaded.
		options.dataUrl = urlObj.href;

		// Now call changePage() and tell it to switch to
		// the page we just modified.
		$j.mobile.changePage( $page, options );
	}
}

/**
 * Take an array of records, and populate the list view
 **/
BuildingChecks.prototype.onSuccessSfdcBuildingChecks = function(records)
{
	if (debugMode) logToConsole('BuildingChecks.prototype.onSuccessSfdcBuildingChecks length:' + records.length);
	var that=this;
	var $j = jQuery.noConflict();
 	$j( document ).bind("pagebeforechange", function(e, data) {
 		// this code taken from http://jquerymobile.com/demos/1.2.0/docs/pages/page-dynamic.html
 		// We only want to handle changePage() calls where the caller is
 		// asking us to load a page by URL.
 		if ( typeof data.toPage === "string" ) {

 			// We are being asked to load a page by URL, but we only
 			// want to handle URLs that request the data for a specific
 			// page.
 			var u = $j.mobile.path.parseUrl( data.toPage ),
 				re = /^#areapage/;

 			if ( u.hash.search(re) !== -1 ) {

 				// We're being asked to display the items for a specific area.
 				// Call our internal method that builds the content for the area
 				// on the fly based on our in-memory area data structure.
 				showArea( u, data.options );

 				// Make sure to tell changePage() we've handled this call so it doesn't
 				// have to do anything.
 				e.preventDefault();
 			}
 		}
		});
	
   if (records.length > 0)
    {
	   	currentBuildingChecks = new Object();
	   	$j("#div_sfdc_wellbeing_list").html("");
	    var nestedList = "<ul data-role='listview' id='nestedlist'>";
	    var currentArea = "";
	    var areaMap;
	    var checkCount=0;
	    $j.each(records, function(i, buildingCheck) 
	    {
	    	if (currentArea != buildingCheck.Area__c)
	    	{
	    		currentArea = buildingCheck.Area__c;
	    		var checkTime = buildingCheck.Time_of_Check__c.substring (11,16);
	    		var displayTime = buildingCheck.Time_to_display_on_phone__c;
	    		var areaID = buildingCheck.Area__c.replace(/\W/g,"")+checkTime.replace(/:/g,"");
	    		var newListElement = '<li id="'+areaID+'"><a href="#areapage?area='+areaID+'">'+displayTime + " " + buildingCheck.Area__c + '</a></li>';
	    		if (debugMode) logToConsole ('remove areaID ' + newListElement);
	    		nestedList += newListElement;

	    		checkCount = 0;
	    		areaMap = new Object();
	    		currentBuildingChecks[areaID]=areaMap;
	    	};
	    	areaMap[checkCount++] = buildingCheck;
	    	//nestedList += that.displayOneCheck (i, buildingCheck);
	      });
	    nestedList += "</ul>";
	    $j("#div_sfdc_wellbeing_list").append ($j(nestedList));

	    $j("#div_sfdc_wellbeing_list").trigger( "create" )
    }
    else
    {
    	$j("#div_sfdc_wellbeing_list").html("No Building Checks Available");
    	var interval = setTimeout(function(){
    		$j.mobile.loading('hide');
    	},1); 
    	alert ("No Building Checks Available");
    }
}

function displayOneCheck (i, buildingCheck)
{
	var that=this;
    var newLi = '<li id="item' + i + '"><div data-role="fieldcontain" id="div'+i + '">';
    newLi += "<fieldset data-role='controlgroup' data-type='horizontal' id='b" + i + "' >";
    newLi += "<legend>" + buildingCheck.Area_Item_Name__c + "</legend>";

    newLi += "<label for='OK" + i + "'>OK</label>";
    newLi += "<input type='radio' id='OK" + i + "' data-theme='c' name='n" + i + "' value='OK' ";
    if (buildingCheck.Result__c == 'OK') {newLi += "checked >"} else {newLi += ">"};

    newLi += "<label for='Issue" + i + "'>Issue</label>";
    newLi += "<input type='radio' id='Issue" + i + "' data-theme='c' name='n" + i + "' value='Issue' ";
    if (buildingCheck.Result__c == 'Issue') {newLi += "checked >"} else {newLi += ">"};
    

    newLi += "<label for='Hazard" + i + "'>Hazard Only</label>";
    newLi += "<input type='radio' id='Hazard" + i + "' data-theme='c' name='n" + i + "' value='Hazard Only' ";
    if (buildingCheck.Result__c == 'Hazard Only') {newLi += "checked >"} else {newLi += ">"};

    newLi += "</fieldset>";
    newLi += "</div>";
 
    return  newLi;
}

BuildingChecks.prototype.addClickHandlersToList = function (i, buildingCheck)
{
	var $j = jQuery.noConflict();
	var that=this;
    $j('#OK'+i).click(function() {
        buildingCheck.Result__c = 'OK';
        that.updateRecord (buildingCheck, onUpdateError);
        that.removeItem (i, buildingCheck);
    });
    $j('#Issue'+i).click(function(event) {
        buildingCheck.Result__c = 'Issue';
        var problem=prompt("Please describe the issue", "");
        if (problem != null)
        {
          buildingCheck.Item_Check_Comment__c = problem;
          buildingCheck.Type_of_Hazard__c = '';
          that.updateRecord (buildingCheck, onUpdateError);
          that.removeItem (i, buildingCheck);
        }
     });
    $j('#Hazard'+i).click(function(event) {
        buildingCheck.Result__c = 'Hazard Only';
        var problem=prompt("Please describe the hazard", "");
        if (problem != null)
        {
          buildingCheck.Item_Check_Comment__c = problem;
          buildingCheck.Type_of_Hazard__c = '';
          that.updateRecord (buildingCheck, onUpdateError);
          that.removeItem (i, buildingCheck);
        }
    });
}

BuildingChecks.prototype.removeItem = function (itemIndex, bldCheck)
{
	var $j = jQuery.noConflict();
	var that=this;
	var checkTime = bldCheck.Time_of_Check__c.substring (11,16).replace(/:/g,"");
	var areaID = '#' + bldCheck.Area__c.replace(/\W/g,"")+checkTime;
	var itemID = '#item' + itemIndex;
	var numSiblings = $j(itemID).siblings().length;
    $j(itemID).remove();

    if (numSiblings == 0)
    {
    	if (debugMode) logToConsole ('BuildingChecks.prototype.removeItem areaID: ' + areaID);
    	$j(areaID).remove();
    	$j("#nestedlist").listview("refresh");
    }
    else 
    {
    	$j("#ul"+itemIndex).listview("refresh");
    }
	
}

/**
 * Soup Successfully Queried
 **/
BuildingChecks.prototype.onSuccessQuerySoup = function(cursor) {
//	console.log('BuildingChecks.prototype.onSuccessQuerySoup');
	var that = this;
	var records = [];

    //DF12 DEMO 12 -- LOAD RECORDS
	records = Util.LoadAllRecords(cursor,records);

	//close the query cursor
	sfSmartstore.closeCursor(cursor);
	that.onSuccessSfdcBuildingChecks(records);    
}

function onUpdateError(error) {
    alert('Error updating Building Checks');
	var $j = jQuery.noConflict();
	var interval = setTimeout(function(){
		$j.mobile.loading('hide');
	},1);      
}