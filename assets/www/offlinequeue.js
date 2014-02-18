function OfflineQueue() {

}

/**
 * Queue for later upload
 **/
OfflineQueue.QueueRecords = function(whichSoup, records,error){
    //DF12 DEMO 19 -- REGISTER QUEUE SOUP AND STORE QUEUE RECORDS
//	console.log('OfflineQueue.QueueRecords');	
	OfflineQueue.RegisterQueueSoup(whichSoup, function(){
		sfSmartstore.upsertSoupEntriesWithExternalId(whichSoup,records, 'Id', function(){
//		sfSmartstore.upsertSoupEntries(whichSoup,records, function(){
//			console.log("Queue Upsert Success for " + whichSoup);        
		}, error);		
	},error);
}

/**
 * Upload Queue to Salesforce
 **/
OfflineQueue.UploadQueue = function(whichSoup, callback,error) {
//	console.log("OfflineQueue.UploadQueue for " + whichSoup);
	if(Util.checkConnection()) {
//      	console.log("OfflineQueue.UploadQueue -- app is online");
        //DF12 DEMO 23 -- UPLOAD QUEUE TO SFDC
      	sfSmartstore.soupExists(whichSoup,function(param){
		if(param)
		{
//			console.log("OfflineQueue.UploadQueue -- " + whichSoup + " Queue exists");
				OfflineQueue.LoadRecordsFromQueue(whichSoup, function(records) {
					if(records.length==0){
//                       	console.log("OfflineQueue.UploadQueue -- no records in queue");
						if (callback) callback();
					}
					else {				
//                        console.log("OfflineQueue.UploadQueue -- iterating records");
						for(i in records){
							var updateField;
							var sfObject;
							if (whichSoup == 'WellBeingUploadQueue') 
							{
								updateField = {"Wellbeing_Status__c":records[i].Wellbeing_Status__c};
								sfObject = 'Wellbeing_Check__c';
							}
							else
							{
//								updateField = {"Result__c":records[i].Result__c};
								updateField = {"Result__c":records[i].Result__c, "Item_Check_Comment__c":records[i].Item_Check_Comment__c, "Type_of_Hazard__c":records[i].Type_of_Hazard__c};								sfObject = 'Item_Check__c';
							};
							forcetkClient.update(sfObject, records[i].Id, updateField, function(){
//								console.log('QUEUED SFDC Update Success!');
                                //DF12 DEMO 24 -- ON SUCCESS, REMOVE RECORD FROM QUEUE
								sfSmartstore.removeFromSoup(whichSoup,[records[i]._soupEntryId],function(){
//									console.log('Removed from Soup');
									if(i == records.length-1) {
										if (callback) callback();
									}
								},error);
							},error);				
						}
					}
				},error);
			}
			else {
//				console.log("Offline queue doesn't exist yet... must not be any records there...")
				if (callback) callback();
			}
		},error);


	}
	else {
//		console.log("We're offline, can't upload queue... how'd we even get here?")
		if (callback) callback();
	}

}

/**
 * Load records from Queue - on their way to Salesforce
 **/
OfflineQueue.LoadRecordsFromQueue = function(whichSoup, callback,error){
//	console.log("OfflineQueue.loadRecordsFromQueue");
	var that=this;
    var querySpec = sfSmartstore.buildAllQuerySpec("Id", null, 2000);
        
    sfSmartstore.querySoup(whichSoup,querySpec, function(cursor) { 
		var records = [];
		records = Util.LoadAllRecords(cursor,records);
//		console.log ('Records loaded ' + JSON.stringify(records));
		if (records.length > 0)
		{
//			console.log ('LoadRecordsFromQueue One record id retrieved ' + records[0].Id);
		}
		else
		{
//			console.log ('LoadRecordsFromQueue No records retrieved');
		}
		//close the query cursor
		sfSmartstore.closeCursor(cursor);
		callback(records);
    },error);
}

/**
 * Register the Queue soup if it doesn't already exist
 **/
OfflineQueue.RegisterQueueSoup = function(whichSoup,callback,error){
//	console.log('OfflineQueue.registerQueueSoup');
	//check if the soup exists
	sfSmartstore.soupExists(whichSoup,function(param){
		if(!param){
			//soup doesn't exist, so let's register it
			var indexSpec=[{"path":"Id","type":"string"}];
			sfSmartstore.registerSoup(whichSoup,indexSpec,function(param){
//				console.log(whichSoup + ' Soup Created: '+param);
				callback();
			},error);
		}
		else {
			callback();
		}
	},error);
}
