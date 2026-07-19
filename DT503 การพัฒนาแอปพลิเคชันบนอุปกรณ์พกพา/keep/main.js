<h1>Restaurants</h1>
<ul class="restaurants">
<% restaurants.forEach(function(data){ %>
<li class="restaurants-item">
<img src="<%= data.imageURL %>" class="restaurants-item-image">
<div class="restaurants-item-name"><%= data.name %></div>
<small class="restaurants-item-type"><%= data.type %></small>
</li>
<% }) %>
</ul>