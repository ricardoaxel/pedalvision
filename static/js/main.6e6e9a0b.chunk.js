(this.webpackJsonppedalvision=this.webpackJsonppedalvision||[]).push([[0],{120:function(e,t,a){"use strict";a.r(t);var n=a(0),r=a.n(n),c=a(10),l=a.n(c),o=(a(90),a(14)),i=a(23),u=a(68),s=a(12),d=a.n(s),p=a(17),f=a(7),m=a(69),b=a.n(m),v=(a(96),b.a.initializeApp({apiKey:"AIzaSyBXbDlB7l3dP-FiF9TBBk8v9rgnx359BME",authDomain:"pedalvision-9ea13.firebaseapp.com",databaseURL:"https://pedalvision-9ea13.firebaseio.com",projectId:"pedalvision-9ea13",storageBucket:"pedalvision-9ea13.appspot.com",messagingSenderId:"437452844119",appId:"1:437452844119:web:588adb82ef9bcd6f4e4712",measurementId:"G-TSHSPTWWM1"}).firestore()),g={id:"",PBName:"",PBBrand:"",PBImage:"",PBHeight:"",PBWidth:""};var E=function(e){return function(){var t=Object(p.a)(d.a.mark((function t(a,n){var r,c,l;return d.a.wrap((function(t){for(;;)switch(t.prev=t.next){case 0:if(t.prev=0,r={},c=[],!localStorage.getItem("avPBs")){t.next=7;break}c=JSON.parse(localStorage.getItem("avPBs")),t.next=12;break;case 7:return t.next=9,v.collection("pedalboards").get();case 9:l=t.sent,c=l.docs.map((function(e){return Object(f.a)({id:e.id},e.data())})),localStorage.setItem("avPBs",JSON.stringify(c));case 12:r=c.find((function(t){return t.id===e})),a({type:"SET_PB",payload:r}),t.next=19;break;case 16:t.prev=16,t.t0=t.catch(0),console.log(t.t0);case 19:case"end":return t.stop()}}),t,null,[[0,16]])})));return function(e,a){return t.apply(this,arguments)}}()},O={id:"",Name:"",Brand:"",Type:"",Image:"",Video:"",Height:"",Width:""};var h=function(e){return function(){var t=Object(p.a)(d.a.mark((function t(a,n){var r,c,l;return d.a.wrap((function(t){for(;;)switch(t.prev=t.next){case 0:if(t.prev=0,r={},c=[],!localStorage.getItem("avPedals")){t.next=7;break}c=JSON.parse(localStorage.getItem("avPedals")),t.next=12;break;case 7:return t.next=9,v.collection("pedals").get();case 9:l=t.sent,c=l.docs.map((function(e){return Object(f.a)({id:e.id},e.data())})),localStorage.setItem("avPedals",JSON.stringify(c));case 12:r=c.find((function(t){return t.id===e})),a({type:"SET_PEDAL",payload:r}),t.next=19;break;case 16:t.prev=16,t.t0=t.catch(0),console.log(t.t0);case 19:case"end":return t.stop()}}),t,null,[[0,16]])})));return function(e,a){return t.apply(this,arguments)}}()},P=a(19),y=a(70),j={userPedals:{}};var S=Object(i.c)({pedalboard:function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:g,t=arguments.length>1?arguments[1]:void 0;switch(t.type){case"SET_PB":return Object(f.a)(Object(f.a)({},e),t.payload);default:return e}},actualPedal:function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:O,t=arguments.length>1?arguments[1]:void 0;switch(t.type){case"SET_PEDAL":return Object(f.a)(Object(f.a)({},e),t.payload);default:return e}},userPB:function(){var e=arguments.length>0&&void 0!==arguments[0]?arguments[0]:j,t=arguments.length>1?arguments[1]:void 0;switch(t.type){case"SET_USERPB":return Object(f.a)(Object(f.a)({},e),{},{userPedals:Object(f.a)(Object(f.a)({},e.userPedals),{},Object(P.a)({},Math.random().toString(36).substr(2,9),Object(f.a)({},t.payload.newPedal)))});case"SET_MOVEPEDAL":var a=t.payload.id;return Object(f.a)(Object(f.a)({},e),{},{userPedals:Object(f.a)(Object(f.a)({},e.userPedals),{},Object(P.a)({},a,Object(f.a)(Object(f.a)({},e.userPedals[a]),{},{left:t.payload.left,top:t.payload.top})))});case"SET_DELETEPEDAL":var n=t.payload;return Object(f.a)(Object(f.a)({},e),{},{userPedals:Object(y.omit)(e.userPedals,n)});case"SET_LOADPB":return Object(f.a)(Object(f.a)({},e),{},{userPedals:t.payload});default:return e}}}),B=window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__||i.d;var x=a(166),k=a(73),w=a(159),I=a(121),D=a(165),N=a(13),T=a(167),_=a(170),A=a(158);var C=function(){var e=Object(o.b)(),t=r.a.useState([]),a=Object(N.a)(t,2),n=a[0],c=a[1],l=r.a.useState([]),i=Object(N.a)(l,2),u=i[0],s=i[1];r.a.useEffect((function(){localStorage.getItem("avPBs")?c(JSON.parse(localStorage.getItem("avPBs"))):function(){var e=Object(p.a)(d.a.mark((function e(){var t,a;return d.a.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return e.prev=0,e.next=3,v.collection("pedalboards").get();case 3:t=e.sent,a=t.docs.map((function(e){return Object(f.a)({id:e.id},e.data())})),c(a),localStorage.setItem("avPBs",JSON.stringify(a)),e.next=12;break;case 9:e.prev=9,e.t0=e.catch(0),console.log(e.t0);case 12:case"end":return e.stop()}}),e,null,[[0,9]])})));return function(){return e.apply(this,arguments)}}()()}),[]);var m=r.a.useState([]),b=Object(N.a)(m,2),g=b[0],O=b[1],h=r.a.useState([]),P=Object(N.a)(h,2),y=P[0],j=P[1],S=r.a.useState(!1),B=Object(N.a)(S,2),x=B[0],k=B[1],w=function(){var e=Object(p.a)(d.a.mark((function e(){var t,a;return d.a.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return e.prev=0,e.next=3,v.collection("userPBs").get();case 3:t=e.sent,a=t.docs.map((function(e){return Object(f.a)({id:e.id},e.data())})),s(a),k(!0),e.next=12;break;case 9:e.prev=9,e.t0=e.catch(0),console.log(e.t0);case 12:case"end":return e.stop()}}),e,null,[[0,9]])})));return function(){return e.apply(this,arguments)}}(),I=Object(o.c)((function(e){return e.userPB.userPedals})),D=function(){var e=Object(p.a)(d.a.mark((function e(){var t,a;return d.a.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return t=prompt("Please enter a name for the PB"),console.log(t,". Pedales:",I,"PB",g),a={Name:t,Pedals:I,Pedalboard:g,User:"default"},e.next=5,v.collection("userPBs").add(a);case 5:case"end":return e.stop()}}),e)})));return function(){return e.apply(this,arguments)}}();return r.a.createElement("form",{noValidate:!0,autoComplete:"off"},r.a.createElement("div",null,x?r.a.createElement(T.a,{select:!0,id:"savedPB",label:"Saved PB's",value:y,onChange:function(t){j(t.target.value),e(E(t.target.value.Pedalboard)),e(function(e){return function(){var t=Object(p.a)(d.a.mark((function t(a,n){return d.a.wrap((function(t){for(;;)switch(t.prev=t.next){case 0:try{a({type:"SET_LOADPB",payload:e})}catch(n){console.log(n)}case 1:case"end":return t.stop()}}),t)})));return function(e,a){return t.apply(this,arguments)}}()}(t.target.value.Pedals))}},u.map((function(e){return r.a.createElement(_.a,{key:e.id,value:e},e.Name)}))):r.a.createElement(A.a,{onClick:function(){return w()},size:"large",color:"primary",variant:"outlined"},"Load PB"),r.a.createElement("br",null),r.a.createElement("br",null),r.a.createElement(A.a,{onClick:function(){return D()},size:"large",color:"primary",variant:"outlined"},"SAVE PB"),r.a.createElement(T.a,{select:!0,id:"pbselect",label:"PedalBoard",value:g,onChange:function(t){O(t.target.value),e(E(t.target.value))},helperText:"Please select your Pedalboard"},n.map((function(e){return r.a.createElement(_.a,{key:e.id,value:e.id},e.PBName)})))))};var L=function(){var e=Object(o.b)(),t=r.a.useState([]),a=Object(N.a)(t,2),n=a[0],c=a[1];r.a.useEffect((function(){localStorage.getItem("avPedals")?c(JSON.parse(localStorage.getItem("avPedals"))):function(){var e=Object(p.a)(d.a.mark((function e(){var t,a;return d.a.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:return e.prev=0,e.next=3,v.collection("pedals").get();case 3:t=e.sent,a=t.docs.map((function(e){return Object(f.a)({id:e.id},e.data())})),c(a),localStorage.setItem("avPedals",JSON.stringify(a)),e.next=12;break;case 9:e.prev=9,e.t0=e.catch(0),console.log(e.t0);case 12:case"end":return e.stop()}}),e,null,[[0,9]])})));return function(){return e.apply(this,arguments)}}()()}),[]);var l=r.a.useState([]),i=Object(N.a)(l,2),u=i[0],s=i[1];return r.a.createElement("form",{noValidate:!0,autoComplete:"off"},r.a.createElement("div",null,r.a.createElement(T.a,{select:!0,id:"pbselect",label:"Pedal",value:u,onChange:function(t){s(t.target.value),e(h(t.target.value))},helperText:"Please select a pedal"},n.map((function(e){return r.a.createElement(_.a,{key:e.id,value:e.id},e.Name)})))))},J=a(160),M=a(163),z=a(161),V=a(162),R=a(71),W=a.n(R),U=Object(w.a)({root:{minWidth:"100%"},bullet:{display:"inline-block",margin:"0 2px",transform:"scale(0.8)"},title:{fontSize:14},pos:{marginBottom:12}}),H=function(){var e=Object(o.c)((function(e){return e.actualPedal})),t=U(),a=Object(o.b)(),n=function(){var t,n,r,c;a((t=e.Image,n=e.Width,r=e.Height,c=e.id,function(){var e=Object(p.a)(d.a.mark((function e(a,l){return d.a.wrap((function(e){for(;;)switch(e.prev=e.next){case 0:try{a({type:"SET_USERPB",payload:{newPedal:{image:t,width:n,height:r,left:0,top:0,pedalID:c}}})}catch(l){console.log(l)}case 1:case"end":return e.stop()}}),e)})));return function(t,a){return e.apply(this,arguments)}}()))};return r.a.createElement("div",null,""!==e.Name?r.a.createElement(J.a,{className:t.root},r.a.createElement(z.a,null,r.a.createElement(V.a,{className:t.title,color:"textSecondary",gutterBottom:!0},"Selected Pedal"),r.a.createElement(V.a,{variant:"h5",component:"h4"},e.Name),r.a.createElement(V.a,{className:t.pos,color:"textSecondary"},e.Brand),r.a.createElement("img",{src:e.Image,style:{width:"100%"},alt:""}),r.a.createElement(V.a,{variant:"subtitle2",color:"textSecondary"},e.Type)),r.a.createElement(M.a,{style:{justifyContent:"center"}},r.a.createElement(A.a,{onClick:function(){return n()},size:"large",color:"primary",variant:"outlined"},"ADD")),r.a.createElement("br",null),r.a.createElement(W.a,{url:e.Video,width:"100%",height:"100%",controls:"true"})):"No pedal selected yet")},F=a(169),X="userPB",G=a(168),K=a(164),q=a(72),Q=a.n(q),Y={position:"absolute",padding:"0.5rem 1rem",cursor:"move",width:"200px",height:"300px",backgroundSize:"100%",backgroundRepeat:"no-repeat"},Z=function(e){var t=e.id,a=e.left,n=e.top,c=e.hideSourceOnDrag,l=(e.children,e.image),i=e.pedalID,u=Object(o.b)(),s=function(){u(function(e){return function(){var t=Object(p.a)(d.a.mark((function t(a,n){return d.a.wrap((function(t){for(;;)switch(t.prev=t.next){case 0:try{a({type:"SET_DELETEPEDAL",payload:e})}catch(n){console.log(n)}case 1:case"end":return t.stop()}}),t)})));return function(e,a){return t.apply(this,arguments)}}()}(t))},m=Object(G.a)({item:{id:t,left:a,top:n,type:X},collect:function(e){return{isDragging:e.isDragging()}}}),b=Object(N.a)(m,2),v=b[0].isDragging,g=b[1];return v&&c?r.a.createElement("div",{ref:g}):r.a.createElement("div",{onClick:function(){u(h(i))},ref:g,style:Object(f.a)(Object(f.a)({},Y),{},{left:a,top:n,backgroundImage:"url(".concat(l)})},r.a.createElement(K.a,{onClick:function(){return s()},style:{position:"absolute",top:"-5%",left:"80%"},"aria-label":"delete"},r.a.createElement(Q.a,null)))},$=function(){var e=Object(o.c)((function(e){return e.pedalboard.PBImage})),t={pbContainer:{width:"100%",height:"1000px",backgroundSize:"100%",backgroundImage:"url(".concat(e,")"),backgroundRepeat:"no-repeat"}},a=Object(o.c)((function(e){return e.userPB.userPedals})),n=Object(o.b)(),c=Object(F.a)({accept:X,drop:function(e,t){var a=t.getDifferenceFromInitialOffset(),n=Math.round(e.left+a.x),r=Math.round(e.top+a.y);i(e.id,n,r)}}),l=Object(N.a)(c,2)[1],i=function(e,t,a){n(function(e,t,a){return function(){var n=Object(p.a)(d.a.mark((function n(r,c){return d.a.wrap((function(n){for(;;)switch(n.prev=n.next){case 0:try{r({type:"SET_MOVEPEDAL",payload:{id:e,left:t,top:a}})}catch(c){console.log(c)}case 1:case"end":return n.stop()}}),n)})));return function(e,t){return n.apply(this,arguments)}}()}(e,t,a))};return r.a.createElement("div",{ref:l,style:t.pbContainer},Object.keys(a).map((function(e){var t=a[e],n=t.left,c=t.top,l=t.image,o=t.pedalID;return r.a.createElement(Z,{key:e,id:e,left:n,top:c,pedalID:o,image:l,hideSourceOnDrag:"true"})})))},ee=Object(w.a)((function(e){return{root:{flexGrow:1},paper:{padding:e.spacing(2),textAlign:"center",color:e.palette.text.secondary}}}));function te(){var e=ee(),t=Object(i.e)(S,B(Object(i.a)(u.a)));return r.a.createElement(o.a,{store:t},r.a.createElement("div",{className:e.root},r.a.createElement(D.a,{container:!0,spacing:1},r.a.createElement(D.a,{item:!0,xs:9},r.a.createElement(I.a,{className:e.paper},r.a.createElement("h3",{style:{textAlign:"left"}},"Pedalboard Planner")),r.a.createElement("br",null),r.a.createElement(I.a,{className:e.paper},r.a.createElement(x.a,{backend:k.a},r.a.createElement($,null)))),r.a.createElement(D.a,{item:!0,xs:3},r.a.createElement(I.a,{className:e.paper},r.a.createElement(C,null),r.a.createElement(L,null),r.a.createElement("br",null),r.a.createElement(H,null),r.a.createElement("br",null))))))}l.a.render(r.a.createElement(r.a.StrictMode,null,r.a.createElement(te,null)),document.getElementById("root"))},85:function(e,t,a){e.exports=a(120)},90:function(e,t,a){}},[[85,1,2]]]);
//# sourceMappingURL=main.6e6e9a0b.chunk.js.map