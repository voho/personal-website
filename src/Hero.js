import React from 'react';
import img1 from "./image/voho_electronic_music_black_and_white_illustration_5e714953-1695-49b5-a7a4-7a2b75ba153f.png";

function Hero() {
  return (
    <div class="hero">

      <div class="hero-image">
        <img src={img1} alt="Aurora" />
      </div>

      <div class="hero-content">
        <h1>Vojta Hordějčuk</h1>
        <p>Creative Developer</p>
      </div>

      <div class="hero-links">
        <ul>
          <li><a href="http://www.linkedin.com/in/vohocz">LinkedIn</a></li>
          <li><a href="https://github.com/voho">GitHub</a></li>
          <li><a href="https://open.spotify.com/artist/4OaWtKAgl8oGU9QTa4wXu4">Spotify</a></li>
          <li><a href="https://itunes.apple.com/us/artist/voho/id1213510083">iTunes</a></li>
          <li><a href="https://www.instagram.com/vohocz/">Instagram</a></li>
        </ul>
      </div>

    </div>
  );
}

export default Hero;
