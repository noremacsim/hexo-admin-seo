
var DataFetcher = require('./data-fetcher');
var api = require('./api');
var React = require('react/addons')
var cx = React.addons.classSet
var Promise = require('es6-promise').Promise
var marked = require('marked')
var Editor = require('./editor')
var _ = require('lodash')
var moment = require('moment')
var Router = require('react-router');
var Confirm = require('./confirm');

var confirm = function (message, options) {
  var cleanup, component, props, wrapper;
  if (options == null) {
    options = {};
  }

  props = $.extend({
    message: message
  }, options);
  wrapper = document.body.appendChild(document.createElement('div'));
  component = React.renderComponent(<Confirm {...props}/>, wrapper);
  cleanup = function () {
    React.unmountComponentAtNode(wrapper);
    return setTimeout(function () {
      return wrapper.remove();
    });
  };

  return component.promise.always(cleanup).promise();
};

var Post = React.createClass({
  mixins: [DataFetcher((params) => {
    return {
      post: api.post(params.postId),
      tagsCategoriesAndMetadata: api.tagsCategoriesAndMetadata(),
      settings: api.settings()
    }
  })],

  getInitialState: function () {
    return {
      updated: moment()
    }
  },

  componentDidMount: function () {
    this._post = _.debounce((update) => {
      var now = moment()
      api.post(this.props.params.postId, update).then(() => {
        this.setState({
          updated: now
        })
      })
    }, 1000, {trailing: true, loading: true})
  },

  handleChange: function (update) {
    var now = moment()
    api.post(this.props.params.postId, update).then((data) => {
      var state = {
        tagsCategoriesAndMetadata: data.tagsCategoriesAndMetadata,
        post: data.post,
        updated: now,
        author: data.post.author,
      }
      for(var i=0; i<data.tagsCategoriesAndMetadata.metadata.length; i++){
        var name = data.tagsCategoriesAndMetadata.metadata[i]
        state[name] = data.post[name]
      }
      this.setState(state)
    })
  },

  handleChangeContent: function (text) {
    if (text === this.state.raw) {
      return
    }
    this.setState({
      raw: text,
      updated: null,
      rendered: this.RenderAndReplaceImageLinks(text)
    })
    this._post({_content: text})
  },

  RenderAndReplaceImageLinks: function (text) {
    let html = marked(text);
    let featureImageSet = false;

    // Create a temporary DOM element to hold the text
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;

    // Select all image elements within the temporary element
    const images = tempDiv.querySelectorAll('img');

    // Loop through each image element
    images.forEach(image => {
      // Get the current src attribute
      const src = image.getAttribute('src');
      let newSrc = src;

      // Check if the src doesn't contain '/blog/'
      if (!src.includes('/blog/')) {
        // Modify the src attribute to include '/blog/'
        newSrc = '/blog/' + src;
        image.setAttribute('src', newSrc);
      }

      this.handleChangeFeatureImage(newSrc);
      featureImageSet = true;
    });

    return tempDiv.innerHTML;
  },

  handleChangeFeatureImage: function (imageSrc) {
    if (imageSrc === this.state.featureImage) {
      return
    }
    this.setState({featureImage: imageSrc});
    this._post({featureImage: imageSrc})
  },

  handleChangeTitle: function (title) {
    if (title === this.state.title) {
      return
    }
    this.setState({title: title});
    this._post({title: title})
  },

  handleChangeKeyWords: function (keyWords) {
    if (keyWords === this.state.keyWords) {
      return
    }
    this.setState({keyWords: keyWords});
    this._post({keyWords: keyWords})
  },

  handleChangeMetaDescription: function (metaDescription) {
    if (metaDescription === this.state.metaDescription) {
      return
    }
    this.setState({metaDescription: metaDescription});
    this._post({metaDescription: metaDescription})
  },

  handlePublish: function () {
    if (!this.state.post.isDraft) return
    api.publish(this.state.post._id).then((post) => {
      this.setState({post: post})
    });
  },

  handleUnpublish: function () {
    if (this.state.post.isDraft) return
    api.unpublish(this.state.post._id).then((post) => {
      this.setState({post: post})
    });
  },

  handleRemove: function () {
    var self = this;
    return confirm('Delete this post?', {
      description: 'This operation will move current draft into source/_discarded folder.',
      confirmLabel: 'Yes',
      abortLabel: 'No'
    }).then(function () {
      api.remove(self.state.post._id).then(
        Router.transitionTo('posts')
      );
    });
  },

  dataDidLoad: function (name, data) {
    if (name !== 'post') return
    var parts = data.raw.split('---');
    var _slice = parts[0] === '' ? 2 : 1;
    var raw = parts.slice(_slice).join('---').trim();
    this.setState({
      title: data.title,
      metaDescription: data.metaDescription,
      keyWords: data.keyWords,
      featureImage: data.featureImage,
      initialRaw: raw,
      raw: raw,
      rendered: data.content
    })
  },

  render: function () {
    var post = this.state.post
    var settings = this.state.settings
    if (!post || !this.state.tagsCategoriesAndMetadata || !settings) {
      return <span>Loading...</span>
    }
    return Editor({
      post: this.state.post,
      raw: this.state.initialRaw,
      updatedRaw: this.state.raw,
      wordCount: this.state.raw ? this.state.raw.split(' ').length : 0,
      isDraft: post.isDraft,
      updated: this.state.updated,
      title: this.state.title,
      metaDescription: this.state.metaDescription,
      keyWords: this.state.keyWords,
      rendered: this.state.rendered,
      onChange: this.handleChange,
      onChangeContent: this.handleChangeContent,
      onChangeTitle: this.handleChangeTitle,
      onChangeKeyWords: this.handleChangeKeyWords,
      onChangemetaDescription: this.handleChangeMetaDescription,
      onPublish: this.handlePublish,
      onUnpublish: this.handleUnpublish,
      onRemove: this.handleRemove,
      tagsCategoriesAndMetadata: this.state.tagsCategoriesAndMetadata,
      adminSettings: settings
    })
  }
});

module.exports = Post;
