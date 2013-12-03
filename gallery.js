/*
    This snippet is an angular service which defines the logic of a page gallery (photo and video): there are no dialogs (so no lightbox), when you enter
    the resource url, you get the resource with the comments and the details. Then, users, through keyboard arrows, virtual arrows
    or swipe (enabled on touch devices using Hammer.js) can view, using CSS3 transitions, the previous or the next resource.
    To enhance the UX, we implemented a caching + preloading mechanism. The API returns the current resource, other 4 resources when existing and two pointers,
    next and previous, in order to implement a circular array.
 */

.factory('singlePageGallery', ['$filter',function($filter) {

    // let's define a closure with privileged methods (getter & setter)
    // buffer is an object, not an array, since we don't care of the order (we use the order array for that), we use it as a map.

    var instance = {}, buffer = {}, currentIndex = 0, nextRes = {}, previousRes = {}, album = {}, order = [];

    instance.setOrderArray = function(array)
    {
        order = array;
    }

    // order must be preloaded
    instance.getOrderArray = function()
    {
        return order;
    }

    instance.isBufferEmpty = function() {
        return jQuery.isEmptyObject(buffer);
    }

    instance.getCurrentResource = function(id,type) {
        var key= id+"_"+type; // key format: "{id}_{type}"

        if(buffer.hasOwnProperty(key))
            return buffer[key];

        return null;

    }

    instance.isResourceCached = function(id,type) {
        var key= id+"_"+type;

        if(buffer.hasOwnProperty(key))
            return true

        return false;
    }

    instance.isConditionViolated = function(action) {
        // check, based on the action, if at least two resources exist before (previous) or after (next) the current one
        // it's the fetching condition

        var index1,index2,key1,key2;
        if(action === 'next') // user action
        {
            index1 = currentIndex+1 > order.length -1 ? 0 : currentIndex+1;
            index2 = currentIndex+2 > order.length -1 ? 1 : currentIndex+2;
            key1 = order[index1].pk+"_"+order[index1].type;
            key2 = order[index2].pk+"_"+order[index2].type;
         // console.log("NEXT: INDEX1: "+index1+" INDEX2: "+index2);
         // console.log("NEXT: KEY1: "+key1+" KEY2: "+key2);
         // console.log("CONDITION1: "+buffer.hasOwnProperty(key1)+" CONDITION2: "+buffer.hasOwnProperty(key2));

            if(buffer.hasOwnProperty(key1) && buffer.hasOwnProperty(key2))
            {
                return false;
            }

        }
        else
        {
            index1 = currentIndex-1 >= 0  ? currentIndex-1 : order.length-1;
            index2 = currentIndex-2 >= 0  ? currentIndex-2 : order.length-2;
            key1 = order[index1].pk+"_"+order[index1].type;
            key2 = order[index2].pk+"_"+order[index2].type;
          // console.log("PREV: INDEX1: "+index1+" INDEX2: "+index2);
          // console.log("PREV: KEY1: "+key1+" KEY2: "+key2);
          // console.log("CONDITION1: "+buffer.hasOwnProperty(key1)+" CONDITION2: "+buffer.hasOwnProperty(key2));

            if(buffer.hasOwnProperty(key1) && buffer.hasOwnProperty(key2))
            {
                return false;
            }

        }
        return true;
    }

    instance.cacheResources = function(res,prevResources,nextResources, action) {
        var joinedArray = [];
        joinedArray = joinedArray.concat(prevResources);
        joinedArray.push(res);
        joinedArray = joinedArray.concat(nextResources);

        for(var i=0; i<joinedArray.length; i++)
        {
            var key = joinedArray[i].id+"_"+joinedArray[i].type;

            if(!buffer.hasOwnProperty(key))
                buffer[key] = joinedArray[i];

        }

    }

    instance.initCurrentIndex = function(id,type) {

        for(var i=0; i< order.length; i++)
        {
            if(order[i].pk === id && order[i].type === type)
            {  currentIndex=i;
                return;
            }
        }
       // console.log("INIT: "+currentIndex );
    }

    instance.getCurrentIndex = function()
    {
        return currentIndex;
    }

    instance.preloadProperImage = function(action) {

        var currentIndex = instance.getCurrentIndex();
        var key,element,index;
        var counter = 1;
        var images = [];
        for(var i = 1;i<2;i++)            // for loop since for now I'm preloading just the next or previous one, before it was 2
        {
            if(action === "next" || !action)
            { index = (currentIndex+i) % order.length;  }
            else if(action === "prev")
            {
            index = (currentIndex-i) < 0 ? order.length-i : currentIndex-i;  }
            element = order[index];

            if(element)
            {    key = element.pk+"_"+element.type;
                if(buffer.hasOwnProperty(key))
                {   //console.log("preload"+key);
                    images[counter] = new Image();
                    images[counter].src = buffer[key].medium;
                }
            }
            counter--;
        }

    }

    instance.getNextResourceKey = function()
    {
        currentIndex++;
        if(currentIndex >= order.length)
            currentIndex=0;

       // console.log('current index '+currentIndex);
        return order[currentIndex];

    }

    instance.getPreviousResourceKey = function()
    {
        currentIndex--;

        if(currentIndex < 0)
        {
            currentIndex = order.length-1;
        }
       // console.log('current index '+currentIndex);

        return order[currentIndex];

    }

    instance.setServerNext = function(next) {
        if(!instance.isResourceCached(next.id,next.type) || order.length <=5)      // to manage back and forth behaviour
            nextRes = next;
    }

    instance.getServerNext = function() {
        return nextRes;
    }

    instance.setServerPrevious = function(prev) {
        if(!instance.isResourceCached(prev.id,prev.type)|| order.length <=5)
            previousRes = prev;
    }

    instance.getServerPrevious = function() {
        return previousRes;
    }

    instance.setAlbum = function(albumResource)
    {
        album = albumResource;
    }

    instance.getAlbum = function()
    {
        return album;
    }

    return instance;

}]);
