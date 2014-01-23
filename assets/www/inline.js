/*
* Author: Eamon Kelly, Enclude
* Purpose: Top level menu
* Called from: index.html
*/
/* TODO
 *	should not need to login every day
 * 
 */
var building = "Back Lane";
var wellBeingChecks;
var itemChecks;
var User_check_minutes_before_hour = 15;
var Show_user_checks_in_future_minutes = 60;
var Item_check_minutes_before_hour = 15;
var Show_item_checks_in_future_minutes = 60;

function regLinkClickHandlers() 
{
    var $j = jQuery.noConflict();
    wellBeingChecks = new WellBeing();
    itemChecks = new BuildingChecks();
    
    $j('#link_fetch_wellbeingchecks').click(function() 
    {
    	if (debugMode) logToConsole("regLinkClickHandlers: link_fetch_sfdc_wellbeingchecks clicked");
	    $j("#div_sfdc_wellbeing_list").html("");
        wellBeingChecks.loadRecords (onErrorWellBeingloadRecords);
    });

    $j('#link_fetch_buildingchecks').click(function() 
    {
 	    $j("#div_sfdc_wellbeing_list").html("");
        itemChecks.loadRecords (onErrorItemChecksloadRecords);
    });

    $j('#link_fetch_syncchecks').click(function() 
    {
        if(Util.checkConnection())
        {
        	OfflineQueue.UploadQueue(wellbeingUploadQueue);
        	OfflineQueue.UploadQueue(buildingUploadQueue);
        	alert ('Stored checks sent to Salesforce');
        }
        else alert ('Not connected to the internet');
    });
     
    $j('#link_reset').click(function() 
    {
 		wellBeingChecks.clearRecords();
		itemChecks.clearRecords();
    });

    $j('#link_logout').click(function() 
    {
     	logout ();
    });
    
    $j(document).on('create', '#wellbeingpage' ,function()
    {
    	if (debugMode) logToConsole ("regLinkClickHandlers: Change to wellbeing page");
    	$j.mobile.changePage ($j('#wellbeingpage'));
    });
     
    $j(document).on('pageshow', '#wellbeingpage' ,function()
    {
    	if (debugMode) logToConsole ("regLinkClickHandlers: onPageShow wellbeing page");
    	$j.mobile.loading('hide');
    });

    if (debugMode) logToConsole ("regLinkClickHandlers: In regLinkClickHandlers User ID is " + userId);
    if(Util.checkConnection()) 
    {
    	if (debugMode) logToConsole ('regLinkClickHandlers: Valid connection, find out which building');
    	forcetkClient.query("SELECT Building__c from User where id = '" + userId + "'", onSuccessUserBuilding, onFailQueryUserBuilding); // this is the first call to Salesforce
    }
    else
    {
    	if (debugMode) logToConsole ('regLinkClickHandlers: No connection found');
    }
}

// because this is right at the start, if there is an error, logout and try again
function onFailQueryUserBuilding (jqXHR, textStatus, errorThrown)
{
	if (debugMode) 
	{
		logToConsole ('onFailQueryUserBuilding ' + JSON.stringify(jqXHR) + ' textStatus: ' + textStatus + ' errorThrown: ' + errorThrown);
		alert ('Error from Salesforce: ' + JSON.stringify(jqXHR));
	}
	logout ();
}

function logout ()
{
    var sfOAuthPlugin = cordova.require("salesforce/plugin/oauth");
    sfOAuthPlugin.logout();
}

function onSuccessUserBuilding (response)
{
	if (debugMode) logToConsole ('In onSuccessUserBuilding');
	var $j = jQuery.noConflict();
	    
	$j.each(response.records, function(i, user) 
	{
	   	if (user.Building__c != "") building = user.Building__c;
	});
	$j("#buildingname").html("Building is: " + building);
	getCheckSettings ();
}

function getCheckSettings ()
{
	if (debugMode) logToConsole ('In getCheckSettings');
    forcetkClient.query("select User_check_minutes_before_hour__c, Show_user_checks_in_future_minutes__c, Item_check_minutes_before_hour__c, Show_item_checks_in_future_minutes__c from Check_Settings__c limit 1", onGetCheckSettings, onErrorGetCheckSettings);
}

function onErrorGetCheckSettings (error)
{
	if (debugMode) logToConsole ('In onErrorCheckSettings: ' + JSON.stringify(error));
	hideWaitingCursor ();
}

function onErrorItemChecksloadRecords (error)
{
	if (debugMode) logToConsole ('In onErrorItemChecksloadRecords: ' + JSON.stringify(error));
	hideWaitingCursor ();
}

function onErrorWellBeingloadRecords (error)
{
	if (debugMode) logToConsole ('In onErrorWellBeingloadRecords: ' + JSON.stringify(error));
	hideWaitingCursor ();
}

function onGetCheckSettings (response)
{
	if (debugMode) logToConsole ('In onGetCheckSettings');
	if (response.records.length > 0)
	{
		if (debugMode) logToConsole ('In onGetCheckSettings, settings retrieved');
		User_check_minutes_before_hour = response.records[0].User_check_minutes_before_hour__c;
		Show_user_checks_in_future_minutes = response.records[0].Show_user_checks_in_future_minutes__c;
		Item_check_minutes_before_hour = response.records[0].Item_check_minutes_before_hour__c;
		Show_item_checks_in_future_minutes = response.records[0].Show_item_checks_in_future_minutes__c;
	}
}

function onSuccessDevice(contacts) 
{
    if (debugMode) logToConsole("onSuccessDevice: received " + contacts.length + " contacts");
    var $j = jQuery.noConflict();
    $j("#div_device_contact_list").html("")
    var ul = $j('<ul data-role="listview" data-inset="true" data-theme="a" data-dividertheme="a"></ul>');
    $j("#div_device_contact_list").append(ul);
    
    ul.append($j('<li data-role="list-divider">Device Contacts: ' + contacts.length + '</li>'));
    $j.each(contacts, function(i, contact) 
    {
    	var formattedName = contact.name.formatted;
        if (formattedName) 
        {
        	var newLi = $j("<li><a href='#'>" + (i+1) + " - " + formattedName + "</a></li>");
        	ul.append(newLi);
        }
     });
    
    $j("#div_device_contact_list").trigger( "create" )
}

function onSuccessSfdcContacts(response) 
{
    if (debugMode) logToConsole("onSuccessSfdcContacts: received " + response.totalSize + " contacts");
    var $j = jQuery.noConflict();
    
    $j("#div_sfdc_contact_list").html("")
    var ul = $j('<ul data-role="listview" data-inset="true" data-theme="a" data-dividertheme="a"></ul>');
    $j("#div_sfdc_contact_list").append(ul);
    
    ul.append($j('<li data-role="list-divider">Salesforce Contacts: ' + response.totalSize + '</li>'));
    $j.each(response.records, function(i, contact) 
    {
    	var newLi = $j("<li><a href='#'>" + (i+1) + " - " + contact.Name + "</a></li>");
        ul.append(newLi);
    });
    
    $j("#div_sfdc_contact_list").trigger( "create" )
}

function onSuccessSfdcAccounts(response) 
{
    if (debugMode) logToConsole("onSuccessSfdcAccounts: received " + response.totalSize + " accounts");
    var $j = jQuery.noConflict();
    
    $j("#div_sfdc_account_list").html("")
    var ul = $j('<ul data-role="listview" data-inset="true" data-theme="a" data-dividertheme="a"></ul>');
    $j("#div_sfdc_account_list").append(ul);
    
    ul.append($j('<li data-role="list-divider">Salesforce Accounts: ' + response.totalSize + '</li>'));
    $j.each(response.records, function(i, record) 
    {
    	var newLi = $j("<li><a href='#'>" + (i+1) + " - " + record.Name + "</a></li>");
        ul.append(newLi);
    });
    
    $j("#div_sfdc_account_list").trigger( "create" )
}

function hideWaitingCursor ()
{
	var $j = jQuery.noConflict();
	var interval = setTimeout(function(){
		$j.mobile.loading('hide');
	},1);      
}