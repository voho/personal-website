import React, { useEffect, useState } from 'react';
import img1 from "./image/a1.png";
import img2 from "./image/a2.png";
import img3 from "./image/a3.png";
import img4 from "./image/a4.png";
import img5 from "./image/a5.png";
import img6 from "./image/a6.png";
import img7 from "./image/a7.png";
import img8 from "./image/a8.png";
import img9 from "./image/a9.png";
import img10 from "./image/a10.png";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithubAlt, faItunesNote, faInstagramSquare, faSpotify, faLinkedin } from '@fortawesome/free-brands-svg-icons';

const images = [img1, img2, img3, img4, img5, img6, img7, img8, img9, img10];

function getRandomImage() {
  return images[Math.floor(Math.random() * images.length)];
}

function Hero() {
  return (
    <div className="hero">

      <div className="hero-image">
        <img src={getRandomImage()} alt="Just an image" />
      </div>

      <div className="hero-content">
        <h1>Vojta Hordějčuk</h1>
        <h2>alias voho</h2>

        <div className="two-cols">
          <div className="two-cols-inner">
            <p>Creative Developer<br />Electronic Music Producer<br />Woodworker<br />Father</p>
          </div>
          <div className="two-cols-inner">
            <p><small><a href="mailto:vojtech&#46;hordejcuk&#64;gmail&#46;com">vojtech&#46;hordejcuk&#64;gmail&#46;com</a></small></p>
          </div>
        </div>
      </div>

      <div className="hero-links">
        <ul>
          <li><FontAwesomeIcon icon={faLinkedin} size="2x" fixedWidth color='#9BA5AE' /> <a href="http://www.linkedin.com/in/vohocz">LinkedIn</a></li>
          <li><FontAwesomeIcon icon={faGithubAlt} size="2x" fixedWidth color='#9BA5AE' /> <a href="https://github.com/voho">GitHub</a></li>
          <li><FontAwesomeIcon icon={faSpotify} size="2x" fixedWidth color='#9BA5AE' /> <a href="https://open.spotify.com/artist/4OaWtKAgl8oGU9QTa4wXu4">Spotify</a></li>
          <li><FontAwesomeIcon icon={faItunesNote} size="2x" fixedWidth color='#9BA5AE' /> <a href="https://itunes.apple.com/us/artist/voho/id1213510083">iTunes</a></li>
          <li><FontAwesomeIcon icon={faInstagramSquare} size="2x" fixedWidth color='#9BA5AE' /> <a href="https://www.instagram.com/vohocz/">Instagram</a></li>
        </ul>
      </div>

    </div>
  );
}

export default Hero;
