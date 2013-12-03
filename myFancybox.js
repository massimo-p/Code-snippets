/*
    This directive integrates a customised version of the jQuery.fancybox plugin.
    The goal is to create a FB style lightbox with image on the left and details (comment, etc.) on the right.
    Details and comments are retrieved from 2 REST APIs
    We injected 2 custom helper services, permissions and sharedUtils. The actual API call is delegated to another service,
    "api", which is called within the controller.
 */

.directive('myFancybox',['$rootScope','$compile','$location','permissions','sharedUtils','$q',
    function ($rootScope, $compile, $location,permissions,sharedUtils,$q) {
        return {
            link: function (scope, element, attrs) {     //executed when my-fancybox is found in the DOM
                var id,type,template;

                // preload the partial

                $.get(EVERSNAP.partials+'/picture_details.html')
                    .done(function(pictureTemplate) {
                        template = pictureTemplate;
                    }).fail(function(data){
                        console.log('error loading template');
                        console.log(data);
                    });

                var newScope, promiseComments, promiseDetails;

                // preload  Sublime Video player APIs
                sublime.load();

                // fancybox initialisation: by default it uses  "live" binding

                $(".fancybox").fancybox({
                    parent: '#galleryContainer',
                    beforeLoad: function(){  // fancybox callback

                        /* to avoid memory leaks due to accumulated watchers while navigating in the fancybox we manually handle the scope
                         generating a new child scope for each image, compiling the details template and destroying it when closing the fancy
                         or moving to the previous/next one.
                         */

                        if(newScope)    // check if we must free the old scope so we get rid of the old watchers
                        {
                            newScope.$destroy();
                        }

                        newScope = $rootScope.$new();
                        newScope.fancyboxDetails = {};
                        newScope.fancyboxDetails.comments = {};

                        // we don't need to parse it
                        id = $(this.element).attr('id');

                        if($(this.element).hasClass('videobox'))
                        {
                            type = 'video';
                        } else {
                            type = 'picture';
                        }

                        // in these methods we perform the actual call to the API, loading in this way comments and details.
                        // Then we resolve the promises and we process the obtained data
                        promiseComments = scope.getComments(id,type);
                        promiseDetails = scope.getResourceDetails(id,type);

                        // myPermission is an helper (service) which defines the permission for the current user
                        promiseDetails.then(function success (data) {

                            newScope.fancyboxDetails.res = type === 'picture' ? data.photo : data.video;
                            newScope.fancyboxDetails.res.can_delete = ((newScope.fancyboxDetails.res.myPermissions & permissions.getPermissions().DELETE) > 0);
                            newScope.fancyboxDetails.res.can_edit = ((newScope.fancyboxDetails.res.myPermissions & permissions.getPermissions().EDIT) > 0);
                            newScope.fancyboxDetails.res.can_like_comment = ((newScope.fancyboxDetails.res.myPermissions & permissions.getPermissions().LIKE_COMMENT) > 0);
                            newScope.fancyboxDetails.res.can_read = ((newScope.fancyboxDetails.res.myPermissions & permissions.getPermissions().READ) > 0);
                            newScope.fancyboxDetails.detailsLoading = false;
                            newScope.fancyboxDetails.res.type = type === 'picture' ? 1 : 2;
                            newScope.fancyboxDetails.res.likeAction = newScope.fancyboxDetails.res.likeId  ? 'Unlike' : 'Like';

                            // helper to determine the styling of the likes
                            var conditions = sharedUtils.computeLikesDisplayConditions(newScope.fancyboxDetails.res.likers,newScope.fancyboxDetails.res.likesNum, newScope.fancyboxDetails.res.likeId);
                            newScope.fancyboxDetails.res.noOtherLikers = conditions.noOtherLikers;
                            newScope.fancyboxDetails.res.otherLikersNum = conditions.otherLikersNum;

                            // Fill the share links
                            var url = 'http://' + window.location.hostname + '/' + type + '/' +newScope.fancyboxDetails.res.id ;
                            var picture = newScope.fancyboxDetails.res.thumb;
                            var fbId = 0000000000;

                            var facebookShareHref = 'https://www.facebook.com/dialog/feed?app_id=' + fbId +
                                '&display=popup&link=' + encodeURIComponent(url) +
                                '&picture=' + encodeURIComponent(picture) +
                                '&name='+encodeURIComponent(newScope.fancyboxDetails.res.album.title) +
                                '&description='+encodeURIComponent("The easiest and most convenient way to share your memories in one place.") +
                                '&redirect_uri='+encodeURIComponent(url);

                            var pinterestShareHref = '//pinterest.com/pin/create/button/?url=' + encodeURIComponent(url) +
                                '&media=' + encodeURIComponent(picture) +
                                '&description=' + encodeURIComponent("The easiest and most convenient way to share your memories in one place.");

                            newScope.fancyboxDetails.facebookShare = facebookShareHref;
                            newScope.fancyboxDetails.pinterestShare = pinterestShareHref;

                        }, function error (data){
                            // when setting the boolean to true, angular will render an alert box
                            newScope.fancyboxDetails.detailsError = true;
                            console.log('promise details error');
                        });
                         // resolving comments promise
                        promiseComments.then(function success(data) {
                            newScope.fancyboxDetails.comments = data.comments;
                        }, function error (){
                            newScope.fancyboxDetails.detailsError = true;
                        });

                    },
                    afterShow: function(){    // fancybox callback

                        // compile and show html when both promises are resolved, not in beforeLoad since we need to get the fancybox height to initialise the scroller

                        $q.all([promiseDetails,promiseComments]).then(function success (){

                            var tpl = $('.fancybox-box').html(template);
                            // compile the template within the generated scope
                            $compile(tpl)(newScope);

                        });

                        id = $(this.element).attr('id');

                        if($(this.element).hasClass('videobox')) // video
                        {
                            $location.path('/video/' + id);

                            // invoke sublime video player
                            sublime.ready(function(){
                                $('#vid' + id).show();
                                sublime.prepare('vid' + id, function(player){});
                            });
                        }
                        else
                        {
                            $location.path('/picture/' + id);
                        }

                        // invoke angular $apply, through a safe method to avoid cuncurrency issues (invoke a $digest while another is
                        // in progress raise an exception), since we are outside the angular context (so trigger a digest to be sure binding are correct)
                        scope.safeApply()
                    },
                    afterClose: function()   // fancybox callback
                    {
                        // "unload" video player
                        if($(this.element).hasClass('videobox')){
                            sublime.unprepare('vid' + id, function(player){});
                        }

                        $location.path('album/' + scope.albumId);

                        scope.safeApply();
                    }
                });
                 // cleanup and deallocate resources
                // destroy fancybox live handler, when scope is destroyed, to avoid multiple binding
                scope.$on("$destroy", function(){
                    $(document).unbind('click.fb-start');
                });
            }}}])