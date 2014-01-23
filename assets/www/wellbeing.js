// var WELLBEING_SOUP_NAME = "wellBeingSoup";
// var lastSoupCursor = null;
// var sfSmartstore = cordova.require("salesforce/plugin/smartstore");

//var building = "Back Lane";
//var lastSoupCursor = null;
var wellbeingUploadQueue = 'WellBeingUploadQueue';
var wellbeingLocalRecords = 'WellbeingChecks';

var sfSmartstore = cordova.require("salesforce/plugin/smartstore");

function WellBeing ()
{
}

WellBeing.prototype.clearRecords = function ()
{
	if (debugMode) logToConsole ("In clearRecord");
	sfSmartstore.removeSoup(wellbeingLocalRecords,
            function(param){}, 
            function(param){});
	sfSmartstore.removeSoup(wellbeingUploadQueue,
            function(param){}, 
            function(param){});
}

/**
 * load records for the app
 **/
WellBeing.prototype.loadRecords = function(error) 
{
	if (debugMode) logToConsole("WellBeing.prototype.loadRecords");
	var $j = jQuery.noConflict();
	var interval = setTimeout(function(){
		        $j.mobile.loading('show', {
		        	text: 'Loading WellBeing Checks',
		        	textVisible: true,
		        	theme: 'a',
		        	html: ""
		        });
		    },1);  

	var that = this;
	sfSmartstore.soupExists(wellbeingLocalRecords,function(param){
		if(Util.checkConnection()){
			that.loadRecordsFromSalesforce(error);
		}
		else {
			that.loadRecordsFromSmartstore(that.onNoRecords);
		}
	},error);
}

WellBeing.prototype.onNoRecords = function () 
{
	alert ('Not online and no local WellBeing Checks found');
	var $j = jQuery.noConflict();
	var interval = setTimeout(function(){
		$j.mobile.loading('hide');
	},1);      
}

/**
 * Store Records
 **/
WellBeing.prototype.storeRecords = function(records,error)
{
	if (debugMode) logToConsole('Wellbeing.prototype.storeRecords ' + records.length + ' records');
	sfSmartstore.upsertSoupEntries(wellbeingLocalRecords,records, function()
	{
		if (debugMode) logToConsole("Soup Upsert Success");        
	}, error);

}



/**
 * load records from salesforce
 **/
WellBeing.prototype.loadRecordsFromSalesforce = function(error) 
{
	if (debugMode) logToConsole("WellBeing.prototype.loadRecordsFromSalesforce");
	var that = this;
	//check if we're online
	if(Util.checkConnection())
	{
		if (debugMode) logToConsole('We are online...');

        // PUSH QUEUE TO SFDC
		OfflineQueue.UploadQueue(wellbeingUploadQueue, function()
		{
			that.clearRecords(); // clear out the old records
			
			if (debugMode) logToConsole('We are online... querying SFDC');
            // QUERY FROM SALESFORCE USING FORCETK
	        var nextHourStarts;
	        var nextHourEnds;
	        var timeNow = new Date();
	        if (timeNow.getMinutes() > (60 - User_check_minutes_before_hour)) nextHourStarts = new Date (timeNow.getFullYear(), timeNow.getMonth(), timeNow.getDate(), timeNow.getHours()+1, 0, 0, 0);
	        else nextHourStarts = new Date (timeNow.getFullYear(), timeNow.getMonth(), timeNow.getDate(), timeNow.getHours(), 0, 0, 0);
	        nextHourEnds = new Date (timeNow.getFullYear(), timeNow.getMonth(), timeNow.getDate(), timeNow.getHours(), timeNow.getMinutes() + Show_user_checks_in_future_minutes, 0, 0);

	        forcetkClient.query("SELECT Id, SortKey__c, Name, Room__c, Service_User_Name__c, Time_of_Check__c, Wellbeing_Status__c FROM Wellbeing_Check__c where Building__c = '" + building + "' and Time_of_Check__c >= " + nextHourStarts.toJSON() + " and Time_of_Check__c <= " + nextHourEnds.toJSON() + " order by SortKey__c limit 200", function(response){  
                that.registerWellBeingSoup(function(){
					that.storeRecords(response.records,error);
				},error);
				that.onSuccessSfdcWellbeingChecks(response.records);
			}, error); 
		},error);
	}
	else 
	{
		if (debugMode) logToConsole('ERROR: Not online');
	}
}

/**
 * Load records from Smartstore
 **/
WellBeing.prototype.loadRecordsFromSmartstore = function(error)
{
	if (debugMode) logToConsole("WellBeing.prototype.loadRecordsFromSmartstore");
	var that=this;

    var querySpec = sfSmartstore.buildAllQuerySpec("SortKey__c", "ascending", 2000);
        
    sfSmartstore.querySoup(wellbeingLocalRecords,querySpec,
                                  function(cursor) { that.onSuccessQuerySoup(cursor); },
                                  error);
}

/**
 * Load record with Id from Smartstore
 **/
WellBeing.prototype.loadRecordWithIdFromSmartstore = function(Id,callback,error)
{
	if (debugMode) logToConsole("WellBeing.prototype.loadRecordWithIdFromSmartstore id is: " + Id);
	var that = this;
	var querySpec = sfSmartstore.buildExactQuerySpec("Id", Id, 2000);
	sfSmartstore.querySoup(wellbeingLocalRecords,querySpec,
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
WellBeing.prototype.updateRecord = function(fieldData,error) 
{
	if (debugMode) logToConsole('WellBeing.prototype.updateRecord');
	var that=this;
	that.loadRecordWithIdFromSmartstore(fieldData.Id,function(records)
	{
		if (debugMode) logToConsole('Smartstore record loaded');
		records[0].Wellbeing_Status__c = fieldData.Wellbeing_Status__c;
		that.storeRecords(records,error);

	    // SAVE TO SALESFORCE IF ONLINE
		if(Util.checkConnection()) {
			forcetkClient.update('Wellbeing_Check__c',fieldData.Id,{"Wellbeing_Status__c":fieldData.Wellbeing_Status__c},function(){
				if (debugMode) logToConsole('SFDC Update Success!');
			},error);
		}
		else
		{
			OfflineQueue.QueueRecords(wellbeingUploadQueue, records, error);
		}
	},error);
}

/**
 * Register the Wellbeing Check local records soup if it doesn't already exist
 **/
WellBeing.prototype.registerWellBeingSoup = function(callback,error)
{
	if (debugMode) logToConsole('WellBeing.prototype.registerWellBeingSoup');
	//check if the Wellbeing_Check__c soup exists
	sfSmartstore.soupExists(wellbeingLocalRecords,function(param){
		if(!param){
			//Wellbeing_Check__c soup doesn't exist, so let's register it
			var indexSpec=[{"path":"Id","type":"string"},{"path":"SortKey__c","type":"string"}];
			sfSmartstore.registerSoup(wellbeingLocalRecords,indexSpec,function(param){
				callback();
			},error);
		}
		else {
			callback();
		}
	},error);
}



/**
 * Take an array of records, and populate the list view
 **/
WellBeing.prototype.onSuccessSfdcWellbeingChecks = function(records)
{
	if (debugMode) logToConsole('WellBeing.prototype.onSuccessSfdcWellbeingChecks');
	var that=this;
	var $j = jQuery.noConflict();
    if (records.length > 0)
    {
	    $j("#div_sfdc_wellbeing_list").html("");
	    
	    $j.each(records, function(i, wellbeing) {
	    	var oneCheck = that.displayOneCheck (i, wellbeing);
	    	
	    	$j("#div_sfdc_wellbeing_list").append ($j(oneCheck));
	        
	    	that.addClickHandlersToList (i, wellbeing);
	      });
	    
	    $j("#div_sfdc_wellbeing_list").trigger( "create" )
    }
    else
    {
    	$j("#div_sfdc_wellbeing_list").html("No WellBeing Checks Available");
    	var interval = setTimeout(function(){
    		$j.mobile.loading('hide');
    	},1);
    	alert ("No WellBeing Checks Available");
    }
}

WellBeing.prototype.displayOneCheck = function (i, wellbeing)
{
	var that=this;
	var checkTime = wellbeing.Time_of_Check__c.substring (11,16);
    var newLi = '<li><div data-role="fieldcontain">';
    newLi += "<fieldset data-role='controlgroup' data-type='horizontal' id='b" + i + "' >";
    newLi += "<legend>" + checkTime + " " + wellbeing.Room__c + " - " + wellbeing.Service_User_Name__c + "</legend>";

    newLi += "<label for='OK" + i + "'>OK</label>";
    newLi += "<input type='radio' id='OK" + i + "' data-theme='c' name='n" + i + "' value='OK' ";
    if (wellbeing.Wellbeing_Status__c == 'OK') {newLi += "checked >"} else {newLi += ">"};

    newLi += "<label for='Out" + i + "'>Out</label>";
    newLi += "<input type='radio' id='Out" + i + "' data-theme='c' name='n" + i + "' value='Out' ";
    if (wellbeing.Wellbeing_Status__c == 'OUT') {newLi += "checked >"} else {newLi += ">"};

    newLi += "<label for='Issue" + i + "'>Issue</label>";
    newLi += "<input type='radio' id='Issue" + i + "' data-theme='c' name='n" + i + "' value='Issue' ";
    if (wellbeing.Wellbeing_Status__c == 'Issue') {newLi += "checked >"} else {newLi += ">"};

    newLi += "</fieldset>";
    newLi += "</div>";
    
    return  newLi;
}

WellBeing.prototype.addClickHandlersToList = function (i, wellbeing)
{
	var $j = jQuery.noConflict();
	var that=this;
    $j('#OK'+i).click(function() {
        wellbeing.Wellbeing_Status__c = 'OK';
        that.updateRecord (wellbeing, onUpdateError);
    });
    $j('#Out'+i).click(function() {
        wellbeing.Wellbeing_Status__c = 'OUT';
        that.updateRecord (wellbeing, onUpdateError);
    });
    $j('#Issue'+i).click(function() {
        wellbeing.Wellbeing_Status__c = 'Issue';
        that.updateRecord (wellbeing, onUpdateError);
    });
}

/**
 * Soup Successfully Queried
 **/
WellBeing.prototype.onSuccessQuerySoup = function(cursor) {
	if (debugMode) logToConsole('WellBeing.prototype.onSuccessQuerySoup');
	var that = this;
	var records = [];

	records = Util.LoadAllRecords(cursor,records);

	//close the query cursor
	sfSmartstore.closeCursor(cursor);
	that.onSuccessSfdcWellbeingChecks(records);    
}

function onUpdateError(error) {
	if (debugMode) logToConsole("onUpdateError: " + JSON.stringify(error) );
    alert('Error updating Wellbeing Check');
	var $j = jQuery.noConflict();
	var interval = setTimeout(function(){
		$j.mobile.loading('hide');
	},1);      
}