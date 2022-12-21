import React from 'react';
import img1 from "./image/a1.jpg";
import img2 from "./image/a2.jpg";
import img3 from "./image/a3.jpg";
import img4 from "./image/a4.jpg";
import img5 from "./image/a5.jpg";
import img6 from "./image/a6.jpg";
import img7 from "./image/a7.jpg";
import img1b from "./image/b1.jpg";
import img2b from "./image/b2.jpg";
import img3b from "./image/b3.jpg";
import img4b from "./image/b4.jpg";
import img5b from "./image/b5.jpg";
import img6b from "./image/b6.jpg";
import img7b from "./image/b7.jpg";
import img8 from "./image/a8.jpg";
import img9 from "./image/a9.jpg";
import img10 from "./image/a10.jpg";
import img11 from "./image/a11.jpg";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGithubAlt, faItunesNote, faInstagramSquare, faYoutube, faSpotify, faLinkedin } from '@fortawesome/free-brands-svg-icons';

const images = [img1, img2, img3, img4, img5, img6, img7, img8, img9, img10, img11, img1b, img2b, img3b, img4b, img5b, img6b, img7b];

function getRandomImage() {
  return images[Math.floor(Math.random() * images.length)];
}

function Hero() {
  return (
    <div className="hero">
      <div className="hero-image">
        <img src={getRandomImage()} alt="an art" />
      </div>
      <div className="hero-name">
        <h1>Vojta Hordějčuk</h1>
        <h2>alias voho</h2>
        <div className="hero-skills">
          <div className="hero-links">
            <h3>Software Developer</h3>
            <ul>
              <li><FontAwesomeIcon icon={faLinkedin} size="2x" fixedWidth color='#0077B5' /> <a href="http://www.linkedin.com/in/vohocz">LinkedIn</a></li>
              <li><FontAwesomeIcon icon={faGithubAlt} size="2x" fixedWidth color='#000' /> <a href="https://github.com/voho">GitHub</a></li>
            </ul>
          </div>
          <div className="hero-links">
            <h3>Music Producer</h3>
            <ul>
              <li><FontAwesomeIcon icon={faSpotify} size="2x" fixedWidth color='#1DB954' /> <a href="https://open.spotify.com/artist/4OaWtKAgl8oGU9QTa4wXu4">Spotify</a></li>
              <li><FontAwesomeIcon icon={faItunesNote} size="2x" fixedWidth color='#D948DD' /> <a href="https://itunes.apple.com/us/artist/voho/id1213510083">iTunes</a></li>
              <li><FontAwesomeIcon icon={faYoutube} size="2x" fixedWidth color='#FF0000' /> <a href="https://www.youtube.com/@vohomusic">YouTube</a></li>
            </ul>
          </div>
          <div className="hero-links">
            <h3>3&#215; Father</h3>
            <ul>
              <li><FontAwesomeIcon icon={faInstagramSquare} size="2x" fixedWidth color='#cd486b' /> <a href="https://www.instagram.com/vohocz/">Instagram</a></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Hero;
